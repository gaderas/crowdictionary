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

*   Implement Infinite Scroll on Definitions page
*   LIMIT all SELECTs to prevent long executing queries attacks
*   Don't query the /v1/login endpoint on nearly every state change
*   Don't query phrase details when navigating from phrase list (where we already have the data)
*   `contributor` table indexes: `status`, `password_reset_status`

TODO Features
----

*   catch top level 404s (would be phrases), redirect to addPhrase
*   PUT /contributors option to trigger start password reset
*   Edit profile. Change password. Recover password.
*   Use # anchors to fix scroll position upon clicking on links
*   Have dedicated password *change* form, to change password while logged in
*   Refactor account verification flow to be more like Contributor Profile edit forms.
*   GET /contributors fields returned should be filtered based on a whitelist, not a blacklist like it is now
*   ~~Put pagination links on phrases list (home, search) for SEO purposes.~~
*   ~~User page (come up with queries, rollup tables)~~
*   ~~Users leaderboard (come up with queries, rollup tables)~~
*   Make definitions linkable
*   Create (editable) user profile page
*   Implement redirect when hitting URLs with no shortLangCode, and cross links to other languages
*   Finish email account creation/verification flow
*   Add social network links, avatar to user profile
*   Allow anonymous voting (guard by IP)
*   Allow Google/Facebook/Twitter login
*   ~~Style (mobile first)~~
*   ~~convert tags into links to phrases. if logged in and phrases don't exist, it's clickable with pre-filled new phrase form.~~
*   ~~Add 'examples', 'tags' fields to definitions~~
*   ~~Don't let users overwrite phrases/definitions submitted by others~~
*   ~~Eliminate remaining pieces of code that still don't use route-based states (except infinite scrolling ones)~~
*   ~~Use icons: account-{login,logout}, person, people, plus, pencil, thumb-up, thumb-down, random, menu?, home, double-quote-{sans,serif}-{left,right}~~
*   ~~Test on mobile~~

BUGS
----

*   Pagination only showing 1 or 2 pages. Infinite scroll is able to load all content, but need pagination to render correct pagination links for SEO.
*   Ip2geo should always be based on passed url parameter, since when it's called from server the referrer will be the server's own.
*   ~~When the mysql library throws an exception (like "/Users/germoad/crowdictionary/node_modules/mysql/lib/protocol/Parser.js:82") hit kills the server~~
*   ~~Sometimes (when infinite scroll pages are hit), the browser history is polluted with lots of wrong and unnecessary entries~~
*   After hitting "/login?contributorAccountCreated=1" by hand, OK is not getting rid of the Info component
*   On visiting "edit profile" page when logged out, we should redirect to "login" or show some message, instead of plain 404.

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
    `curl -X PUT -d '{"email": "germoad@yahoo.com", "submitVerification": "xxxxx"}' -H "Content-Type: application/json" 'http://localhost:3000/v1/contributors?email=germoad@yahoo.com' --cookie-jar /tmp/cookiez -v`
    `curl -X PUT -H "content-type: application/json"  "http://localhost:3000/v1/contributors" -d '{"email": "bono@yahoo.com", "initiate_password_recovery": true}' -v`
    `curl -X PUT -H "content-type: application/json"  "http://localhost:3000/v1/contributors" -d '{"email": "bono@yahoo.com", "password_reset_code": "lalas", "new_password": "tttsssss", "new_password_confirm": "tttsssss"}' -v`
*   GET phrases - get phrases in a specific language
    `curl -H "Accept: application/json" "http://localhost:3000/v1/lang/es-MX/phrases"`
    Search is supported e.g. by performing the following request:
    `curl -H "Accept: application/json" "http://localhost:3000/v1/lang/es-MX/phrases?search=o"`
    Looking for multiple exact phrase matches in one single request can be done as follows:
    `curl -H "Accept: application/json" "http://localhost:3000/v1/lang/es-MX/phrases?phrase=foo&phrase=bar&phrase=baz"`
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


Deployment
----

    * make sure that the following setting is set on mysql's `my.cnf`: `sql_mode = STRICT_ALL_TABLES`
    * check that the setting mentioned above is indeed active by running: `show global variables where variable_name = 'sql_mode';`... the expected output is: `sql_mode: STRICT_ALL_TABLES`
    * copy the `dbip` db (which is not part of the repo), and load it into a database of the same name (`dbip`)
