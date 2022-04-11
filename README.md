# SpotDetector

![](https://i.imgur.com/nwtax7a.png)

# About

[![build](https://github.com/SOBotics/SpotDetector/actions/workflows/nodejs.yml/badge.svg)](https://github.com/SOBotics/SpotDetector/actions/workflows/nodejs.yml)

A bot designed to seek out and provide feedback about potentially bad reviews.

# Check it out

You can find it currently active in the [SOBotics Room](https://chat.stackoverflow.com/rooms/111347/sobotics) currently running under the user [SpotDetector](https://stackoverflow.com/users/10162108/spotdetector).

# Environment variables

| Variable      | Type   | Required? | Default | Description                      |
| ------------- | ------ | --------- | ------- | -------------------------------- |
| API_KEY       | string | yes       | -       | Stack Exchange API key           |
| CHAT_EMAIL    | string | yes       | -       | Chat account email address       |
| CHAT_PASSWORD | string | yes       | -       | Chat account password            |
| CHAT_ROOM     | string | yes       | -       | Room id to report to             |
| TENK_EMAIL    | string | yes       | -       | Account email address (10K+ rep) |
| TENK_PASSWORD | string | yes       | -       | Account password (10K+ rep)      |

# License

All code is licensed under [GPL-3.0-or-later](https://spdx.org/licenses/GPL-3.0-or-later.html) license.
