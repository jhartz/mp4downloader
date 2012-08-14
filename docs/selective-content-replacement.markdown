---
layout: mp4downloader
titlestub: Selective Content Replacement - Docs
dir: ..
---
## Selective Content Replacement

MP4 Downloader's Selective Content Replacement allows certain preferences to be written in a special syntax in which certain values are substituted in for generic variable names. It also allows the use of "<a href="#Ifstatements">*if* statements</a>" to control content.

If you are looking for a method of parsing strings using Selective Content Replacement, see the `parseString` function in: [http://www.mozdev.org/source/browse/mp4downloader/src/1.3.x/modules/util.jsm](http://www.mozdev.org/source/browse/mp4downloader/src/1.3.x/modules/util.jsm?rev=HEAD;content-type=text/plain)

### Table of Contents

- [Variables](#Variables)
  - [List of Variables](#ListOfVariables)
- [If statements](#IfStatements)
  - [Operands](#Operands)
- [Examples](#Examples)

<h3 id="Variables">Variables</h3>

- Variables are written as `%%VAR` (two percent signs (%%) followed by the variable name).
- All variables will be replaced by their corresponding values at runtime.
- All variables MUST be in uppercase text.
- Nothing happens to strings that aren't variables, even if they start with %%, so escaping percent signs is not necessary.

<h4 id="ListOfVariables">List of Variables</h4>

Variables for the Default Filename preference:

- `%%TITLE` - replaced with the current video title
- `%%HQ` - replaced with 1 if the video is currently being downloaded in high-quality/high-definition or 0 if it is not (NOTE: The variable is `%%HQ`, not `%%HD`)
- `%%SITE` - replaced with the current site from which the video is being downloaded
- `%%DOWNURL` - replaced with the direct URL of the video
- `%%PAGEURL` - replaced with the URL of the video page that the video was on (ie. http://www.youtube.com/watch?v=...)
- `%%DTA` - replaced with 1 if DownThemAll is being used to download the video or 0 if it is not

Added in MP4 Downloader version 1.3.3 (still under development):

- `%%YEAR` - replaced with the current year (4 digits)
- `%%SHORTYEAR` - replaced with the current year (2 digits)
- `%%MONTH` - replaced with the current month (numerical - 1 or 2 digits)
- `%%FULLMONTH` - replaced with the current month (full name - January, February, etc.)
- `%%SHORTMONTH` - replaced with a 3-letter abbreviation for the current month (Jan, Feb, Mar, etc.)
- `%%DAY` - replaced with the current day of the month (1 or 2 digits)
- `%%HOUR` - replaced with the current 2-digit hour from a 12-hour clock (1 - 12)
- `%%FULLHOUR` - replaced with the current 2-digit hour from a 24-hour clock (0 - 23)
- `%%MINUTE` - replaced with the current 2-digit minute
- `%%SECOND` - replaced with the current 2-digit second
- `%%NUM` - replaced with the count of how many videos were downloaded so far today (ie. the 5th video downloaded today would be "5") - **NOT YET IMPLEMENTED**
- NOTE: To check AM/PM, you can use: `[[if %%FULLHOUR matches ^(1[2-9]|2[0-3])$]]PM[[else]]AM[[endif]]`

These variables (added in version 1.3.3 - still under development) may not contain data on some videos:

- `%%AUTHOR` - replaced with the video author

<h3 id="IfStatements">*If* statements</h3>

An *if* statement can be used to only show text if a certain variable has a certain value or matches a certain regular expression.

Syntax: `[[if %%VAR OPERAND VALUE]]stuff[[else]]other stuff[[endif]]`

- `%%VAR` is a variable (see [variables](#Variables))
- `OPERAND` is an [operand](#Operands) (either "is", "isnot", "matches", or "imatches" - see below)
- `VALUE` is a string (or regular expression if `OPERAND` is "matches" or "imatches") that is compared to `%%VAR`

All *if* statements should match this regular expression: `\[\[if %%[A-Z]+ (is|isnot|i?matches) .+\]\].*(\[\[else\]\].*)?\[\[endif\]\]`

*If* statements compare a variable (`%%VAR`) to a value (`VALUE`) using the specified operand (`OPERAND`). The *if* statement ends when it reaches `[[endif]]`. An optional `[[else]]` statement can be used to display something in the event that the *if* statement is evaluated to false.

Basic rules:

- The words "if", "else", "endif", and operands ("is", "isnot", and "matches") inside *if* statements must be lowercase.
- All spacing inside *if* statements must be exact (adding extra spaces or other whitespace between the `[[` and `]]` can have unexpected results).
- *If* statements CANNOT be nested within other *if* statements. This can produce unexpected results.
- `]]` should not appear ANYWHERE inside *if* statements. This can also produce unexpected results.
- Variables cannot be used for testing values inside *if* statements (`[[if %%VAR is %%ANOTHERVAR]]stuff[[endif]]` is invalid, although `[[if %%VAR is VALUE]]%%ANOTHERVAR[[endif]]` is still OK).

<h4 id="Operands">Operands</h4>

- Use "is" to test if a variable equals a value: `[[if %%VAR is VALUE]]stuff to display[[endif]]`
- Use "isnot" to test if a variable does not equal a value: `[[if %%VAR isnot VALUE]]stuff to display[[endif]]`
- Use "matches" to test is a variable matches a regular expression: `[[if %%VAR matches REGEXP]]stuff to display[[endif]]`<br>Note: `REGEXP` is a standard JavaScript regular expression that is plugged into JavaScript's [string.match](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/String/match) function. Do NOT include the leading or trailing "/" when specifying the regular expression. To use case-insensitive matching, specify "imatches" instead of "matches": `[[if %%VAR imatches REGEXP]]`

NOTE: Be sure to escape any backslashes in *if* statements! Example: `[[if %%VAR matches .*\.js]]` should be `[[if %%VAR matches .*\\.js]]`

<h3 id="Examples">Examples</h3>

- `%%TITLE ([[if %%HQ is 1]]HD from [[endif]]%%SITE)` will transform into *My Awesome Video (YouTube)* for a standard YouTube video or *My Awesome Video (HD from YouTube)* for an HD version of that video.
- `[[if %%TITLE matches (from|by) Bob$]]A video from my friend[[else]]%%TITLE[[endif]]` will transform into *A video from my friend* for a video titled "blah blah from Bob" or "blah blah by Bob" or just the video title for any other video.