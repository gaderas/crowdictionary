Crowdsourced Dictionary
====

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
*   GET phrase - get a specific phrase
    `curl -H "Accept: application/json" "http://localhost:3000/v1/lang/es-MX/phrases/hola"`
*   PUT phrase - create/update a phrase - spaces in term must be URIEncoded (%20) in the URI
    `curl -X PUT -d '{"phrase": "chau", "lang": "es-MX", "crumb":"OF4iZigBP9Eb5pvuXY2bnSnyWR4"}' -H "Content-Type: application/json" "http://localhost:3000
/v1/lang/es-MX/phrases/chau" --cookie /tmp/cookiez`
*   GET definitions - get definitions for a specific phrase
    `curl -H "Accept: application/json" "http://localhost:3000/v1/lang/es-MX/phrases/hola/definitions" --cookie /tmp/cookiez -v`
*   POST definition - create a definition or update it if current user already submitted one.
    `curl -d '{"crumb": "OF4iZigBP9Eb5pvuXY2bnSnyWR4", "phrase": "hola", "definition": "algo", "lang": "es-MX"}' -H "Content-Type: application/json" "http://localhost:3000/v1/lang/es-MX/phrases/hola/definitions" --cookie /tmp/cookiez -v`
*   PUT vote - vote or change vote if definition_id/contributor_id already voted
    `curl -X PUT -d '{"crumb": "OF4iZigBP9Eb5pvuXY2bnSnyWR4", "vote": "neutral", "definition_id": 1}' -H "Content-Type: application/json" "http://localhost:3000/v1/definitions/1/vote" --cookie /tmp/cookiez -v`
