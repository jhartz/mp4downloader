/*
    Copyright (C) 2016  Jake Hartz
    This source code is licensed under the GNU General Public License version 3.
    For details, see the LICENSE.txt file.
*/

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

var EXPORTED_SYMBOLS = ["mpWindowHandle"];

Cu.import("chrome://mp4downloader/content/modules/mpUtils.jsm");

var mpWindowHandler = {
    loadWindow: loadWindow,
    unloadWindow: unloadWindow,
    addToolbarButton: addToolbarButton
};


/**
 * Load MP4 Downloader into a browser window.
 */
function loadWindow(win) {
    if (win._MP4DOWNLOADER) {
        // We've already been loaded into this window
        return;
    }
    
    win._MP4DOWNLOADER = {};
    
    function elem(type, attributes, oncommand) {
        let e = win.document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", type);
        Object.keys(attributes || {}).forEach(function (attr) {
            if (attr == "class" || attr == "className") {
                e.className += attributes[attr];
            } else {
                e.setAttribute(attr, attributes[attr]);
            }
        });
        if (typeof oncommand == "function") {
            e.addEventListener("command", oncommand, false);
        }
        return e;
    }
    
    // Inject toolbar button
    let button = elem("toolbarbutton", {
        id: "mp4downloader_button",
        className: "toolbarbutton-1",
        label: mpUtils.getString("mp4downloader", "toolbarbutton_label"),
        tooltiptext: mpUtils.getString("mp4downloader", "toolbarbutton_tooltiptext")
    }, function (event) {
        // Clicked!
        win.alert("MP4 Downloader Toolbar Button Clicked!!");
    });
    win.document.getElementById("BrowserToolbarPalette").appendChild(button);
    
    // Inject video page context menu button
    let pageButtonBefore = win.document.getElementById("context-bookmarkpage") || null;
    let pageButton = elem("menuitem", {
        id: "mp4downloader_contextmenu",
        label: mpUtils.getString("mp4downloader", "contextmenu_label")
    }, function (event) {
        // Clicked!
        win.alert("MP4 Downloader Context Menu Button Clicked!!");
    });
    win.document.getElementById("contentAreaContextMenu").insertBefore(pageButton, pageButtonBefore);
    
    // Inject video link context menu button
    let linkButtonBefore = win.document.getElementById("context-sep-open") || null;
    let linkButton = elem("menuitem", {
        id: "mp4downloader_linkcontextmenu",
        label: mpUtils.getString("mp4downloader", "linkcontextmenu_label")
    }, function (event) {
        // Clicked!
        win.alert("mp4 downloader context menu lnk btn clicked");
    });
    win.document.getElementById("contentAreaContextMenu").insertBefore(linkButton, linkButtonBefore);
    
    // Handler to show/hide context menu items
    win._MP4DOWNLOADER.onPopupShowing = function (event) {
        let linkURL = checkLink(win);
        let showPageContextMenu = linkURL === null && checkPageContextMenu(win);
        let showLinkContextMenu = linkURL !== null && checkLinkContextMenu(linkURL);
        
        // Show or hide the context menu buttons
        pageButton.setAttribute("hidden", !showPageContextMenu);
        linkButton.setAttribute("hidden", !showLinkContextMenu);
        
        // Store the linkURL
        win._MP4DOWNLOADER.linkURL = linkURL;
    };
    
    // Listen for when the context menu is showing
    win.document.getElementById("contentAreaContextMenu").addEventListener("popupshowing", win._MP4DOWNLOADER.onPopupShowing, false);
}

/**
 * Unload MP4 Downloader from a browser window.
 */
function unloadWindow(win) {
    if (!win._MP4DOWNLOADER) {
        // We aren't loaded in this window
        return;
    }
    
    // Remove listener for when the context menu is showing
    win.document.getElementById("contentAreaContextMenu").removeEventListener("popupshowing", win._MP4DOWNLOADER.onPopupShowing, false);
    
    // Remove injected elements
    ["mp4downloader_button", "mp4downloader_contextmenu", "mp4downloader_linkcontextmenu"].forEach(function (id) {
        let elem = win.document.getElementById(id);
        if (!elem) return;
        elem.parentNode.removeChild(elem);
    });
    
    // Remove our marker on this window
    delete win._MP4DOWNLOADER;
}

/**
 * Add the MP4 Downloader toolbar button to the current toolbar set.
 */
function addToolbarButton(win) {
    let document = win.document;
    
    if (!document.getElementById("nav-bar")) {
        mpUtils.error(mpUtils.getString("mp4downloader", "error_notoolbar"));
        return false;
    }
    
    var navBar = document.getElementById("nav-bar");
    
    // In SeaMonkey, the button already exists (in BrowserToolbarPalette)
    if (document.getElementById("mp4downloader_button")) {
        // If its parent isn't BrowserToolbarPalette, it's already on the toolbar
        if (document.getElementById("mp4downloader_button").parentNode.id != "BrowserToolbarPalette") {
            return true;
        }
        
        if (document.getElementById("throbber-box") && document.getElementById("throbber-box").parentNode.id != "BrowserToolbarPalette") {
            // Insert before SeaMonkey logo
            navBar.insertItem("mp4downloader_button", document.getElementById("throbber-box"));
        } else if (document.getElementById("print-button") && document.getElementById("print-button").parentNode.id != "BrowserToolbarPalette") {
            // Insert after the print button
            navBar.insertItem("mp4downloader_button", document.getElementById("print-button").nextSibling);
        } else {
            // Just stick at the end of the toolbar
            navBar.insertItem("mp4downloader_button");
        }
        navBar.setAttribute("currentset", navBar.currentSet);
        document.persist("nav-bar", "currentset");
        return true;
    }
    
    // If we're still here, we must be in Firefox
    if (navBar.currentSet.indexOf("downloads-button") != -1) {
        // Insert before the downloads button
        navBar.insertItem("mp4downloader_button", document.getElementById("downloads-button"));
    } else if (navBar.currentSet.indexOf("home-button") > navBar.currentSet.indexOf("urlbar-container")) {
        // If the home button is after the location bar (or if there is no location bar, but there is a home button), insert before home button
        navBar.insertItem("mp4downloader_button", document.getElementById("home-button"));
    } else if (navBar.currentSet.indexOf("home-button") != -1 && navBar.currentSet.indexOf("home-button") < navBar.currentSet.indexOf("urlbar-container")) {
        // If the home button is before the location bar, insert before the location bar
        navBar.insertItem("mp4downloader_button", document.getElementById("urlbar-container"));
    } else {
        // Just stick at the end of the toolbar
        navBar.insertItem("mp4downloader_button", null);
    }
    navBar.setAttribute("currentset", navBar.currentSet);
    document.persist("nav-bar", "currentset");
    return true;
}


/**
 * Determine whether the current popup node is a link.
 *
 * @return the URL if it's a real link, or `null` otherwise.
 */
function checkLink(win) {
    // See if we right-clicked on a link
    let popupTarget = win.document.popupNode;
    while (popupTarget && popupTarget.nodeName && popupTarget.nodeName.toLowerCase() != "a") {
        popupTarget = popupTarget.parentNode;
    }
    if (!popupTarget || !popupTarget.getAttribute || !popupTarget.getAttribute("href")) {
        // Not a link :(
        return null;
    }
    
    let href = popupTarget.getAttribute("href");
    // Check for some "invalid" link URLs
    if (href.substring(0, 11) == "javascript:") return null;
    if (href.substring(0, 7) == "mailto:") return null;
    if (href.substring(0, 6) == "about:") return null;
    if (href.substring(0, 1) == "#") return null;
    
    // Woohoo, we found a real link! Normalize it
    let linkURL = mpUtils.makeURL(popupTarget.getAttribute("href"), win.content.location.href).spec;
    
    let linkHost = mpUtils.getFromString(linkURL, "://", "/");
    let linkPath = mpUtils.getFromString(linkURL, "://");
    linkPath = linkPath.substring(linkPath.indexOf("/"));
    
    // Check if this is a Google search result redirection
    if (linkHost.substring(linkHost.length - 10) == "google.com" && linkPath.substring(0, 5) == "/url?") {
        let origURL = mpUtils.getFromString(linkURL, "?url=", "&") ||
                      mpUtils.getFromString(linkURL, "&url=", "&") ||
                      mpUtils.getFromString(linkURL, "?q=",   "&") ||
                      mpUtils.getFromString(linkURL, "&q=",   "&");
        if (origURL) {
            origURL = decodeURIComponent(origURL);
            if (origURL.indexOf("://") != -1) {
                linkURL = origURL;
            }
        }
    }
    
    // Check if this is a Facebook link redirection
    if (linkHost.substring(linkHost.length - 12) == "facebook.com" && linkPath.substring(0, 7) == "/l.php?") {
        let origURL = mpUtils.getFromString(linkURL, "?u=", "&") ||
                      mpUtils.getFromString(linkURL, "&u=", "&");
        if (origURL) {
            origURL = decodeURIComponent(origURL);
            if (origURL.indexOf("://") != -1) {
                linkURL = origURL;
            }
        }
    }
    
    // Return our final normalized URL
    return linkURL;
}

/**
 * Determine whether the page download button ("Download Video as MP4") should
 * be shown in the context menu.
 *
 * @return true if it should be shown, false otherwise.
 */
function checkPageContextMenu(win) {
    // First, check the pref
    if (!mpUtils.prefs.getBoolPref("contextmenu")) {
        // Disabled; hide it
        return false;
    }
    
    // Check each site module
    for (let module of mpUtils.siteModules) {
        if (module.testWindow(win.content)) {
            // Found one!
            return true;
        }
    }
    
    // If we're still here, we didn't find anything :(
    return false;
}

/**
 * Determine whether the link download button ("Download Link as MP4") should
 * be shown in the context menu.
 *
 * @return true if it should be shown, false otherwise.
 */
function checkLinkContextMenu(linkURL) {
    // First, check the pref
    if (!mpUtils.prefs.getBoolPref("linkcontextmenu")) {
        // Disabled; hide it
        return false;
    }
    
    // Check each site module
    for (let module of mpUtils.siteModules) {
        if (module.getIdFromLink(linkURL)) {
            // Found one!
            return true;
        }
    }
    
    // If we're still here, we didn't find anything :(
    return false;
}
