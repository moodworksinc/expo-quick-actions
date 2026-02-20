"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withAndroidDynamicAppIcons = exports.DEFAULT_ALIAS_SUFFIX = void 0;
const config_plugins_1 = require("@expo/config-plugins");
const { getMainApplicationOrThrow, getMainActivityOrThrow } = config_plugins_1.AndroidConfig.Manifest;
// Import AdaptiveIcon type and withAndroidAppIcon from withAndroidAppIcon
const withAndroidAppIcon_1 = require("./withAndroidAppIcon");
/** Alias name for the default app icon. Must match ExpoAppIconModule.DEFAULT_ALIAS_SUFFIX in Kotlin. */
exports.DEFAULT_ALIAS_SUFFIX = "expo_ic_default";
const withAndroidDynamicAppIcons = (config, { icons }) => {
    // Use withAndroidAppIcon for each icon - it handles colors.xml and image generation
    Object.entries(icons).forEach(([iconName, iconSrc]) => {
        if (!iconSrc)
            return;
        config = (0, withAndroidAppIcon_1.withAndroidAppIcon)(config, {
            name: iconName,
            src: iconSrc,
        });
    });
    // Handle manifest changes (activity-alias creation) - unique to dynamic app icons
    withIconAndroidManifest(config, { icons });
    return config;
};
exports.withAndroidDynamicAppIcons = withAndroidDynamicAppIcons;
const MAIN_LAUNCHER_INTENT_FILTER = {
    action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
    category: [
        { $: { "android:name": "android.intent.category.LAUNCHER" } },
    ],
};
function isMainLauncherIntentFilter(filter) {
    const hasMain = filter.action?.some((a) => a.$?.["android:name"] === "android.intent.action.MAIN") === true;
    const hasLauncher = filter.category?.some((c) => c.$?.["android:name"] === "android.intent.category.LAUNCHER") === true;
    return hasMain && hasLauncher;
}
const withIconAndroidManifest = (config, { icons }) => {
    return (0, config_plugins_1.withAndroidManifest)(config, (config) => {
        const mainApplication = getMainApplicationOrThrow(config.modResults);
        const mainActivity = getMainActivityOrThrow(config.modResults);
        const iconNamePrefix = `${config.android.package}.MainActivity`;
        const iconNames = Object.keys(icons);
        // Remove MAIN/LAUNCHER from MainActivity so only our aliases are launcher entries.
        // This allows the default to be an alias too, so we never disable the "real" activity.
        const intentFilters = (mainActivity["intent-filter"] || []).filter((filter) => !isMainLauncherIntentFilter(filter));
        mainActivity["intent-filter"] = intentFilters;
        function createLauncherIntentFilter() {
            return [MAIN_LAUNCHER_INTENT_FILTER];
        }
        function addDefaultAlias(config) {
            const defaultAlias = {
                $: {
                    "android:name": `${iconNamePrefix}${exports.DEFAULT_ALIAS_SUFFIX}`,
                    "android:enabled": "true",
                    "android:exported": "true",
                    "android:icon": "@mipmap/ic_launcher",
                    "android:roundIcon": "@mipmap/ic_launcher_round",
                    "android:targetActivity": ".MainActivity",
                },
                "intent-filter": createLauncherIntentFilter(),
            };
            return [defaultAlias, ...config];
        }
        function addIconActivityAlias(config) {
            return [
                ...config,
                ...iconNames.map((iconName) => {
                    const iconSrc = icons[iconName];
                    const isAdaptiveIcon = typeof iconSrc === "object" && iconSrc !== null;
                    const activityAliasAttributes = {
                        "android:name": `${iconNamePrefix}${iconName}`,
                        "android:enabled": "false",
                        "android:exported": "true",
                        "android:icon": `@mipmap/${iconName}`,
                        "android:targetActivity": ".MainActivity",
                    };
                    // Only add roundIcon if it's an AdaptiveIcon
                    if (isAdaptiveIcon) {
                        activityAliasAttributes["android:roundIcon"] =
                            `@mipmap/${iconName}_round`;
                    }
                    return {
                        $: activityAliasAttributes,
                        "intent-filter": createLauncherIntentFilter(),
                    };
                }),
            ];
        }
        function removeIconActivityAlias(config) {
            return config.filter((activityAlias) => !activityAlias.$["android:name"].startsWith(iconNamePrefix));
        }
        let activityAliases = removeIconActivityAlias(mainApplication["activity-alias"] || []);
        activityAliases = addDefaultAlias(activityAliases);
        mainApplication["activity-alias"] = addIconActivityAlias(activityAliases);
        return config;
    });
};
