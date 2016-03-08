/*
 * Prefs in preferences dialog
 */

// Is the "Download" button placed below supported videos embedded inside web pages?
pref("extensions.mp4downloader.embedBtn", true);

// Is the "Download" button placed inside the actual video page enabled?
pref("extensions.mp4downloader.embedBtnOnVideo", true);

// Is the context menu button enabled?
pref("extensions.mp4downloader.contextmenu", true);

// Is the context menu button enabled on links to videos?
pref("extensions.mp4downloader.linkcontextmenu", true);

// Should we use DownThemAll to download videos?
// (commented out because this is now handles by saveMode)
//pref("extensions.mp4downloader.dta", false);

// Should we use DownThemAll OneClick to download videos?
pref("extensions.mp4downloader.dtaOneClick", false);

// Should we automatically set the DownThemAll mask to *text*.mp4?
// (disabled by default since dTa then sets it as the mask for all future downloads until changed)
pref("extensions.mp4downloader.dtaAutoMask", false);

// Should we download high-quality videos when possible (YouTube, Dailymotion, and Vimeo only)?
pref("extensions.mp4downloader.hq", false);

// Format of the default file name (uses selective content replacement)
pref("extensions.mp4downloader.defaultFilename", "%%TITLE");

// How to save videos (0 = always ask, 1 = specific dir, 2 = FF downloads directory, 3 = DTA)
pref("extensions.mp4downloader.saveMode", 0);

// Directory to save videos in when saveMode is 1 (uses selective content replacement)
pref("extensions.mp4downloader.saveLocation", "");

// Should we prompt before automtically saving (when saveMode is 1, 2, or 3)?
pref("extensions.mp4downloader.savePrompt", false);

/*
 * Hidden prefs
 */

// Is the "first run" procedure complete?
pref("extensions.mp4downloader.firstRunComplete", false);

// Last version when checked (used to detect when updated to show firstrun page)
pref("extensions.mp4downloader.lastVersion", "0.0");

// Character used to replace illegal characters in file names
pref("extensions.mp4downloader.illegalCharReplacement", "-");


// For prefs that use selective content replacement, information on the syntax can be found at:
// http://jhartz.github.io/mp4downloader/docs/selective-content-replacement.html
