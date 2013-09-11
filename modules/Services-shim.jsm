// Based on resource://gre/modules/Services.jsm
// This is a shim for Firefox 3

this.EXPORTED_SYMBOLS = ["Services"];

const Ci = Components.interfaces;
const Cc = Components.classes;

this.Services = {};


function defineLazyGetter(aName, aLambda) {
    // Based on defineLazyGetter in resource://gre/modules/XPCOMUtils.jsm
    Object.defineProperty(Services, aName, {
        get: function () {
            delete Services[aName];
            return Services[aName] = aLambda.apply(Services);
        },
        configurable: true,
        enumerable: true
    });
}

function defineLazyServiceGetter(aName, aContract, aInterfaceName) {
    // Based on defineLazyServiceGetter in resource://gre/modules/XPCOMUtils.jsm
    defineLazyGetter(aName, function () {
        return Cc[aContract].getService(Ci[aInterfaceName]);
    });
}


// Below is copied from Services.jsm, with defineLazyGetter and defineLazyServiceGetter replaced with alternates from above

defineLazyGetter("prefs", function () {
  return Cc["@mozilla.org/preferences-service;1"]
           .getService(Ci.nsIPrefService)
           .QueryInterface(Ci.nsIPrefBranch);
});

defineLazyGetter("appinfo", function () {
  return Cc["@mozilla.org/xre/app-info;1"]
           .getService(Ci.nsIXULAppInfo)
           .QueryInterface(Ci.nsIXULRuntime);
});

defineLazyGetter("dirsvc", function () {
  return Cc["@mozilla.org/file/directory_service;1"]
           .getService(Ci.nsIDirectoryService)
           .QueryInterface(Ci.nsIProperties);
});

let initTable = [
  ["appShell", "@mozilla.org/appshell/appShellService;1", "nsIAppShellService"],
  ["cache", "@mozilla.org/network/cache-service;1", "nsICacheService"],
  ["console", "@mozilla.org/consoleservice;1", "nsIConsoleService"],
  ["contentPrefs", "@mozilla.org/content-pref/service;1", "nsIContentPrefService"],
  ["cookies", "@mozilla.org/cookiemanager;1", "nsICookieManager2"],
  ["downloads", "@mozilla.org/download-manager;1", "nsIDownloadManager"],
  ["droppedLinkHandler", "@mozilla.org/content/dropped-link-handler;1", "nsIDroppedLinkHandler"],
  ["eTLD", "@mozilla.org/network/effective-tld-service;1", "nsIEffectiveTLDService"],
  ["io", "@mozilla.org/network/io-service;1", "nsIIOService2"],
  ["locale", "@mozilla.org/intl/nslocaleservice;1", "nsILocaleService"],
  ["logins", "@mozilla.org/login-manager;1", "nsILoginManager"],
  ["obs", "@mozilla.org/observer-service;1", "nsIObserverService"],
  ["perms", "@mozilla.org/permissionmanager;1", "nsIPermissionManager"],
  ["prompt", "@mozilla.org/embedcomp/prompt-service;1", "nsIPromptService"],
  ["scriptloader", "@mozilla.org/moz/jssubscript-loader;1", "mozIJSSubScriptLoader"],
  ["scriptSecurityManager", "@mozilla.org/scriptsecuritymanager;1", "nsIScriptSecurityManager"],
  ["search", "@mozilla.org/browser/search-service;1", "nsIBrowserSearchService"],
  ["storage", "@mozilla.org/storage/service;1", "mozIStorageService"],
  ["domStorageManager", "@mozilla.org/dom/storagemanager;1", "nsIDOMStorageManager"],
  ["strings", "@mozilla.org/intl/stringbundle;1", "nsIStringBundleService"],
  ["telemetry", "@mozilla.org/base/telemetry;1", "nsITelemetry"],
  ["tm", "@mozilla.org/thread-manager;1", "nsIThreadManager"],
  ["urlFormatter", "@mozilla.org/toolkit/URLFormatterService;1", "nsIURLFormatter"],
  ["vc", "@mozilla.org/xpcom/version-comparator;1", "nsIVersionComparator"],
  ["wm", "@mozilla.org/appshell/window-mediator;1", "nsIWindowMediator"],
  ["ww", "@mozilla.org/embedcomp/window-watcher;1", "nsIWindowWatcher"],
  ["startup", "@mozilla.org/toolkit/app-startup;1", "nsIAppStartup"],
  ["sysinfo", "@mozilla.org/system-info;1", "nsIPropertyBag2"],
  ["clipboard", "@mozilla.org/widget/clipboard;1", "nsIClipboard"],
  ["DOMRequest", "@mozilla.org/dom/dom-request-service;1", "nsIDOMRequestService"],
  ["focus", "@mozilla.org/focus-manager;1", "nsIFocusManager"],
  ["uriFixup", "@mozilla.org/docshell/urifixup;1", "nsIURIFixup"],
];

initTable.forEach(function ([name, contract, intf])
  defineLazyServiceGetter(name, contract, intf));

initTable = undefined;
