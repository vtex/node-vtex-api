#! /bin/bash

BOLD="\e[1m"
YELLOW="\e[33m"
NO_COLOR="\033[0m"

if [ ! "$IS_CI" == "true" ]; then
    echo -e "${BOLD}${YELLOW}"
    echo -e "============================================================================================="
    echo -e "The CI is configured to publish when a new tag is created."
    echo -e "If you still want to publish yourself you have to set the env variable IS_CI to \"true\""
    echo -e "============================================================================================="
    exit 1
fi