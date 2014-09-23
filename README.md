Crowdsourced Dictionary
====

Building
----

`grunt clean default`

Running a development instance
----

`export NODE_ENV=development; node --harmony server/build/js/app.js --cookies.user.secrets="blah" --data.dbConfig.user="root" --data.dbip.dbConfig.user="root"`

TODO Performance Improvements
----

*   Don't query the /v1/login endpoint on nearly every state change
*   Don't query phrase details when navigating from phrase list (where we already have the data)

TODO Features
----

*   Create (editable) user profile page
*   Add social network links, avatar to user profile
*   ~~Add 'examples', 'tags' fields to definitions~~
*   ~~Don't let users overwrite phrases/definitions submitted by others~~
*   Implement redirect when hitting URLs with no shortLangCode, and cross links to other languages
*   Finish email account creation/verification flow
*   ~~User page (come up with queries, rollup tables)~~
*   Users leaderboard (come up with queries, rollup tables)
*   ~~Eliminate remaining pieces of code that still don't use route-based states (except infinite scrolling ones)~~
*   Style (mobile first)
*   Test on mobile
*   Allow anonymous voting (guard by IP)
*   Allow Google/Facebook/Twitter login

BUGS
----

*   Sometimes (when infinite scroll pages are hit), the browser history is polluted with lots of wrong and unnecessary entries
*   After hitting "/login?contributorAccountCreated=1" by hand, OK is not getting rid of the Info component

Sample requests
----

*   POST login - be issued login cookies
    `curl -d '{"email": "bono@yahoo.com", "passhash": "asdf"}' -H "Content-Type: application/json" "http://localhost:3000/v1/login" --cookie-jar /tmp/cookiez --cookie /tmp/cookiez -v`
*   GET login - get logged in user's details
    `curl -H "Accept: application/json" "http://localhost:3000/v1/login" --cookie /tmp/cookiez -v`
*   GET contributors - get list of contributors' basic info based on exact matching of values in the `contributor` table
    `curl -H "Accept: application/json" 'http://localhost:3000/v1/contributors?email=bono@yahoo.com' --cookie /tmp/cookiez -v`
*   PUT contributors - create (sign/up) or update a contributor's record
    `curl -X PUT -d '{"email": "germoad@yahoo.com", "passhash": "poiuyt", "crumb": "xxxxx"}' -H "Content-Type: application/json" 'http://localhost:3000/v1/contributors?email=germoad@yahoo.com' --cookie-jar /tmp/cookiez -v`
*   GET phrases - get phrases in a specific language
    `curl -H "Accept: application/json" "http://localhost:3000/v1/lang/es-MX/phrases"`
    Search is supported e.g. by performing the following request:
    `curl -H "Accept: application/json" "http://localhost:3000/v1/lang/es-MX/phrases?search=o"`
*   GET phrase - get a specific phrase
    `curl -H "Accept: application/json" "http://localhost:3000/v1/lang/es-MX/phrases/hola"`
*   PUT phrase - create/update a phrase - spaces in term must be URIEncoded (%20) in the URI
    `curl -X PUT -d '{"phrase": "chau", "lang": "es-MX", "crumb":"OF4iZigBP9Eb5pvuXY2bnSnyWR4"}' -H "Content-Type: application/json" "http://localhost:3000
/v1/lang/es-MX/phrases/chau" --cookie /tmp/cookiez`
*   GET definitions - get definitions for a specific phrase
    `curl -H "Accept: application/json" "http://localhost:3000/v1/lang/es-MX/phrases/hola/definitions" --cookie /tmp/cookiez -v`
*   GET definitions - get definitions for supplied set of `phrase_id`
    `curl -H "Accept: application/json" "http://localhost:3000/v1/definitions?phraseIds=2,3,1" --cookie /tmp/cookiez -v`
*   POST definition - create a definition or update it if current user already submitted one.
    `curl -d '{"crumb": "OF4iZigBP9Eb5pvuXY2bnSnyWR4", "phrase": "hola", "definition": "algo", "lang": "es-MX"}' -H "Content-Type: application/json" "http://localhost:3000/v1/lang/es-MX/phrases/hola/definitions" --cookie /tmp/cookiez -v`
*   PUT vote - vote or change vote if definition_id/contributor_id already voted
    `curl -X PUT -d '{"crumb": "OF4iZigBP9Eb5pvuXY2bnSnyWR4", "vote": "neutral", "definition_id": 1}' -H "Content-Type: application/json" "http://localhost:3000/v1/definitions/1/vote" --cookie /tmp/cookiez -v`

