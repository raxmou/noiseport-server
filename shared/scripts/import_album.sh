#!/bin/sh
set -e


# Run beets import with your custom config
beet -c /shared/beet_config_album.yaml import -q "/music/downloads"