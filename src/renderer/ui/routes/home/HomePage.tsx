import "./HomePage.scss";

import { ArrowRight } from "@carbon/icons-react";
import { Button, ButtonSet, Column, Grid, Stack, Tile } from "@carbon/react";

import { AppLink } from "$renderer/components";

const classNs = "home";

export default function HomePage() {
  return (
    <>
      <LastPlayedSection />
    </>
  );
}

function LastPlayedSection() {
  return (
    <>
      <section className={`${classNs}__last-played`}>
        <Grid>
          <Column sm="100%">
            <h2>Last Played</h2>
          </Column>
          <Column sm="100%" md="25%">
            <Tile>
              <h4>Game 1</h4>
              <p>Last played: 2023-10-01</p>
              <Stack gap={4}>
                <Button kind="primary" size="sm">
                  Play
                </Button>
                <Button kind="tertiary" size="sm">
                  View Details
                </Button>
              </Stack>
            </Tile>
          </Column>
        </Grid>
      </section>
    </>
  );
}

interface GamePreviewTileProps {
  gameId: string;
  name: string;
  lastPlayedTimestamp: string;
  synopsis: string;
}
function GamePreviewTile({
  gameId,
  name,
  lastPlayedTimestamp,
  synopsis,
}: GamePreviewTileProps) {
  return (
    <Tile>
      <Grid>
        <Column as="h4" sm="100%">
          {name}
        </Column>
        <Column as="p" sm="100%">
          Last played {lastPlayedTimestamp}
        </Column>
        <Column as="p" sm="100%">
          {synopsis}
        </Column>
        <Column sm="100%">
          <Stack gap={3} orientation="vertical">
            <Button kind="primary" size="sm" style={{ width: "100%" }}>
              Play
            </Button>
            <AppLink
              href={`/games/${gameId}`}
              renderIcon={() => <ArrowRight />}
            >
              View game details
            </AppLink>
          </Stack>
          <ButtonSet stacked={true}>
            <Button kind="tertiary" size="sm"></Button>
          </ButtonSet>
        </Column>
      </Grid>
    </Tile>
  );
}
