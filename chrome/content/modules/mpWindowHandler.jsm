/*
 * Copyright (C) 2016  Jake Hartz
 * This source code is licensed under the GNU General Public License version 3.
 * For details, see the LICENSE.txt file.
 *
 * mpWindowHandler: Functionality related to loading MP4 Downloader UI elements
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

var EXPORTED_SYMBOLS = ["mpWindowHandler"];

Cu.import("chrome://mp4downloader/content/modules/mpUtils.jsm");
Cu.import("chrome://mp4downloader/content/modules/mpContentHandler.jsm");

var mpWindowHandler = {
    loadWindow: loadWindow,
    unloadWindow: unloadWindow,
    addToolbarButton: addToolbarButton
};


/**
 * Load MP4 Downloader into a browser window.
 *
 * @param win - The chrome window to load into.
 * @param {boolean} [isFirstRun] - Whether this is the first time the add-on is
 *        being run (tells us to add the button to the toolbar).
 */
function loadWindow(win, isFirstRun) {
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
    var TIME_inited = new Date();
    let button = elem("toolbarbutton", {
        id: "mp4downloader_button",
        type: "button",
        removable: "true",
        className: "toolbarbutton-1 chromeclass-toolbar-additional",
        label: mpUtils.getString("mp4downloader", "toolbarbutton_label"),
        tooltiptext: mpUtils.getString("mp4downloader", "toolbarbutton_tooltiptext")
    }, function (event) {
        // Clicked!
        win.alert("MP4 Downloader Toolbar Button Clicked!! - " + TIME_inited);
    });
    addToolbarButton(win, button, isFirstRun);
    
    // Inject video page context menu button
    let pageButtonBefore = win.document.getElementById("context-sharepage") ||
                           win.document.getElementById("context-savepage") ||
                           null;
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
    
    // Handler for when a browser tab/page is loaded
    win._MP4DOWNLOADER.onContentLoaded = function (event) {
        if (event && event.originalTarget && event.originalTarget instanceof win.HTMLDocument) {
            //var contentDocument = event.originalTarget.wrappedJSObject || event.originalTarget;
            var contentDocument = event.originalTarget;
            var contentWindow = contentDocument.defaultView;
            if (contentWindow) {
                mpContentHandler.loadContentWindow(contentWindow);
            }
        }
    };
    win.gBrowser.addEventListener("DOMContentLoaded", win._MP4DOWNLOADER.onContentLoaded, false);
}

/**
 * Unload MP4 Downloader from a browser window.
 *
 * @param win - The chrome window to unload from.
 * @param {boolean} [upgradeOnly] - Whether we're going down for upgrade only
 *        (used to try and combat some toolbar button weirdness).
 */
function unloadWindow(win, upgradeOnly) {
    if (!win._MP4DOWNLOADER) {
        // We aren't loaded in this window
        return;
    }
    
    // Remove listener for browser web pages
    win.gBrowser.removeEventListener("DOMContentLoaded", win._MP4DOWNLOADER.onContentLoaded, false);
    
    // Remove listener for when the context menu is showing
    win.document.getElementById("contentAreaContextMenu").removeEventListener("popupshowing", win._MP4DOWNLOADER.onPopupShowing, false);
    
    // Remove injected elements, if necessary
    [
        upgradeOnly ? undefined : "mp4downloader_button",
        "mp4downloader_contextmenu",
        "mp4downloader_linkcontextmenu"
    ].forEach(function (id) {
        if (!id) return;
        let elem = win.document.getElementById(id);
        if (!elem) return;
        elem.parentNode.removeChild(elem);
    });
    
    // Remove our marker on this window
    delete win._MP4DOWNLOADER;
}

/**
 * Add the MP4 Downloader toolbar button to the current toolbar set.
 *
 * @param win - The browser window to add the toolbar button to.
 * @param button - The toolbar button to add (XUL toolbarbutton).
 * @param {boolean} [addToToolbar] - Whether to add the button to the current
 *        toolbar, even if it is not already there.
 */
function addToolbarButton(win, button, addToToolbar) {
    let toolbar = win.document.getElementById("nav-bar"),
        palette = win.document.getElementById("navigator-toolbox").palette;
    if (!toolbar || !palette) {
        mpUtils.error(mpUtils.getString("mp4downloader", "error_notoolbar"));
        return;
    }
    
    // If the button is already in the window, replace it
    let oldButton = win.document.getElementById(button.id);
    if (oldButton) {
        oldButton.parentNode.replaceChild(button, oldButton);
        // And, we're done here
        return;
    }
    
    palette.appendChild(button);
    
    // Based roughly on...
    // http://blog.salsitasoft.com/adding-a-toolbar-button-in-a-bootstrapped-firefox-extension/
    let currentSet = toolbar.getAttribute("currentset").split(","),
        index = currentSet.indexOf(button.id);
    if (index == -1) {
        // Add to the toolbar if firstrun
        if (addToToolbar) {
            let relativeParent = win.document.getElementById("nav-bar-customization-target") || toolbar;
            relativeParent.appendChild(button);
            toolbar.setAttribute("currentset", toolbar.currentSet);
            win.document.persist(toolbar.id, "currentset");
        }
    } else {
        // Our button is in the currentset; find the position and insert the button there
        let before = null;
        for (let i = index + 1; i < currentSet.length; i++) {
            if ((before = win.document.getElementById(currentSet[i]))) break;
        }
        toolbar.insertItem(button.id, before);
    }
    
    /*
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
    */
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
    
    // Woohoo, we found a real link! Normalize it
    let linkURL = mpUtils.makeURL(popupTarget.getAttribute("href"), win.content.location.href).spec;
    
    // If it's not a "full" URL, then we're done
    if (linkURL.indexOf("://") == -1) {
        return linkURL;
    }
    
    // Normalize some common issues with the URL
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
