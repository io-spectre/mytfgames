import { posix } from "node:path";
import { pathToFileURL } from "node:url";

import {
  BrowserWindow,
  BrowserWindowConstructorOptions,
  session,
  WebPreferences,
} from "electron/main";
import { inject, injectable } from "inversify";
import mime from "mime/lite";
import * as R from "remeda";
import * as uuid from "uuid";

import { GameDataService, GameSId } from "$ipc/main-renderer";
import { AppConfiguration } from "$node-base/configuration";
import {
  DatabaseProvider,
  GameId,
  WellKnownDirectory,
} from "$node-base/database";
import {
  dbfsHashToFullBlobPath,
  dbfsResolveFileNodeContentByPath,
} from "$node-base/database-fs";
import { remoteProcedure } from "$pure-base/ipc";

@injectable()
export class HtmlGamePlayService {
  readonly defaultWebPreferences = Object.freeze({
    safeDialogs: true,
    devTools: true,
  } satisfies WebPreferences);

  readonly defaultWindowOptions = Object.freeze({
    width: 1280,
    height: 720,
  } satisfies BrowserWindowConstructorOptions);

  constructor(
    @inject(AppConfiguration) private readonly config: AppConfiguration,
    @inject(DatabaseProvider) private readonly db: DatabaseProvider,
  ) {}

  @remoteProcedure(GameDataService, "startGame")
  async startGame(gameSId: GameSId, version?: string) {
    const gameId = uuid.parse(gameSId) as GameId;
    const gameArtifact =
      version == null
        ? await this.findNewestGameVersion(gameId)
        : await this.db
            .selectFrom("game_version_artifact")
            .where("game_id", "=", gameId)
            .where("version", "=", version)
            .where("platform_type", "=", "html")
            .select(["version", "node_no as nodeNo"])
            .executeTakeFirst();
    if (!gameArtifact) {
      throw new Error("Game artifact not found");
    }
    gameSId = uuid.stringify(gameId);

    const gameSession = this.createGameSession(gameSId);
    const gameUrl = `game://${gameSId}/${version ?? gameArtifact.version}/`;

    const window = new BrowserWindow({
      ...this.defaultWindowOptions,
      webPreferences: {
        ...this.defaultWebPreferences,
        session: gameSession,
      },
    });
    window.webContents.openDevTools();
    await window.loadURL(gameUrl);
  }

  private createGameSession(sessionGameId: GameSId) {
    const gameSession = session.fromPartition(`persist:game-${sessionGameId}`);
    if (gameSession.protocol.isProtocolHandled("game")) {
      return gameSession;
    }

    gameSession.setPermissionCheckHandler(() => false);
    gameSession.setPermissionRequestHandler((_wc, _permission, cb) =>
      cb(false),
    );
    gameSession.protocol.handle("game", async (request) => {
      const url = new URL(request.url);
      if (!uuid.validate(url.host)) {
        throw new TypeError("Invalid game id / host");
      }
      const gameId = uuid.parse(url.host) as GameId;
      const gameSId = uuid.stringify(gameId);
      if (gameSId !== sessionGameId) {
        throw new TypeError("Game Id mismatch");
      }
      const pathname = this.parsePathname(url.pathname);
      if (pathname instanceof Response) {
        return pathname;
      }
      const { version, resourcePath } = pathname;
      const virtualArtifactPath = `${gameSId}/${version}/html/${resourcePath}`;

      const fileInfo = await this.db.transaction().execute(async (trx) => {
        return dbfsResolveFileNodeContentByPath(
          trx,
          WellKnownDirectory.ARTIFACTS,
          virtualArtifactPath,
        );
      });
      if (fileInfo === undefined) {
        return new Response(undefined, { status: 404 });
      }
      const mimeType = mime.getType(resourcePath) ?? "application/octet-stream";
      if (fileInfo.data != null) {
        return new Response(fileInfo.data, {
          status: 200,
          headers: {
            "Content-Length": fileInfo.size.toString(),
            "Content-Type": mimeType,
          },
        });
      }
      const blobPath = dbfsHashToFullBlobPath(this.config, fileInfo.blake3Hash);
      const response = await gameSession.fetch(pathToFileURL(blobPath).href, {
        bypassCustomProtocolHandlers: true,
      });
      if (response.ok) {
        response.headers.set("Content-Type", mimeType);
      }
      return response;
    });

    return gameSession;
  }

  private parsePathname(
    pathname: string,
  ): { version: string; resourcePath: string } | GlobalResponse {
    // pathname must have the structure /<game-version>/<resource-path>

    if (pathname.length < 3) {
      return new Response(undefined, {
        status: 404,
        statusText: "Missing game version",
      });
    }
    let decoded = decodeURIComponent(pathname);
    if (decoded.includes("\0")) {
      return new Response(undefined, {
        status: 400,
        statusText: "Invalid characters in path",
      });
    }
    const versionDelimiter = decoded.indexOf("/", 1);
    if (versionDelimiter === -1) {
      return new Response(undefined, {
        status: 404,
        statusText: "Missing resource path",
      });
    }
    if (decoded.endsWith("/")) {
      decoded += "index.html";
    }
    const version = decoded.slice(1, versionDelimiter);
    const resourcePath = posix.normalize(decoded.slice(versionDelimiter + 1));
    if (resourcePath === ".." || resourcePath.startsWith("../")) {
      return new Response(undefined, {
        status: 400,
        statusText: "Invalid resource path",
      });
    }

    return { version, resourcePath };
  }

  private async findNewestGameVersion(
    gameId: GameId,
  ): Promise<{ version: string; nodeNo: bigint } | undefined> {
    const artifacts = await this.db
      .selectFrom("game_version_artifact")
      .where("game_id", "=", gameId)
      .where("platform_type", "=", "html")
      .select(["version", "node_no as nodeNo"])
      .orderBy("version", "desc")
      .execute();
    if (artifacts.length === 0) {
      return undefined;
    }

    const defaultArtifact = artifacts.reduce((highest, current) =>
      compareVersions(highest.version, current.version) < 0 ? current : highest,
    );
    return defaultArtifact;
  }
}

const versionRegex = /^((?:\d+)(?:\.\d+))*(?:-(.+))$/;
function compareVersions(left: string, right: string): number {
  const leftMatch = versionRegex.exec(left);
  const rightMatch = versionRegex.exec(right);
  if (leftMatch == null || rightMatch == null) {
    return 0;
  }
  const leftVersionParts = leftMatch[1]!.split(".").map(Number.parseInt);
  const rightVersionParts = rightMatch[1]!.split(".").map(Number.parseInt);
  const length = Math.max(leftVersionParts.length, rightVersionParts.length);
  for (let i = 0; i < length; i++) {
    const leftPart = leftVersionParts[i] ?? 0;
    const rightPart = rightVersionParts[i] ?? 0;
    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }
  const leftPreRelease = leftMatch[2];
  const rightPreRelease = rightMatch[2];
  if (leftPreRelease === rightPreRelease) {
    return 0;
  }
  if (leftPreRelease == null) {
    return 1;
  }
  if (rightPreRelease == null) {
    return -1;
  }
  return leftPreRelease < rightPreRelease ? -1 : 1;
}
