#!/bin/bash

cd $(dirname "$0")

gcloud builds submit \
  --project viki-ci \
  --substitutions _MAIN_VERSION=1,_ITERATION=2
