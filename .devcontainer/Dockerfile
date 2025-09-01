FROM mcr.microsoft.com/devcontainers/base:debian-12

USER root

RUN export DEBIAN_FRONTEND=noninteractive; \
    apt-get -qq update && apt-get -qq install --no-install-recommends \
    build-essential \
    libasound2 \
    libatk-bridge2.0 \
    libcups2 \
    libgbm1 \
    libgtk-3-0 \
    libgtk-4-1 \
    libnss3 \
    && apt-get -qq autoremove \
    && apt-get -qq clean \
    && rm -rf /var/lib/apt/lists/*

USER vscode
