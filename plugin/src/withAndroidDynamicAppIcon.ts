import {
  AndroidConfig,
  ConfigPlugin,
  withAndroidManifest,
} from "@expo/config-plugins";

const { getMainApplicationOrThrow, getMainActivityOrThrow } =
  AndroidConfig.Manifest;

// Import AdaptiveIcon type and withAndroidAppIcon from withAndroidAppIcon
import { AdaptiveIcon, withAndroidAppIcon } from "./withAndroidAppIcon";

/** Alias name for the default app icon. Must match ExpoAppIconModule.DEFAULT_ALIAS_SUFFIX in Kotlin. */
export const DEFAULT_ALIAS_SUFFIX = "expo_ic_default";

type Props = {
  icons: Record<string, string | AdaptiveIcon>;
};

export const withAndroidDynamicAppIcons: ConfigPlugin<Props> = (
  config,
  { icons }
) => {
  // Use withAndroidAppIcon for each icon - it handles colors.xml and image generation
  Object.entries(icons).forEach(([iconName, iconSrc]) => {
    if (!iconSrc) return;
    config = withAndroidAppIcon(config, {
      name: iconName,
      src: iconSrc,
    });
  });

  // Handle manifest changes (activity-alias creation) - unique to dynamic app icons
  withIconAndroidManifest(config, { icons });
  return config;
};

const MAIN_LAUNCHER_INTENT_FILTER = {
  action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
  category: [
    { $: { "android:name": "android.intent.category.LAUNCHER" } },
  ],
};

function isMainLauncherIntentFilter(filter: any): boolean {
  const hasMain =
    filter.action?.some(
      (a: any) => a.$?.["android:name"] === "android.intent.action.MAIN"
    ) === true;
  const hasLauncher =
    filter.category?.some(
      (c: any) =>
        c.$?.["android:name"] === "android.intent.category.LAUNCHER"
    ) === true;
  return hasMain && hasLauncher;
}

const withIconAndroidManifest: ConfigPlugin<Props> = (config, { icons }) => {
  return withAndroidManifest(config, (config) => {
    const mainApplication: any = getMainApplicationOrThrow(config.modResults);
    const mainActivity = getMainActivityOrThrow(config.modResults);

    const iconNamePrefix = `${config.android!.package}.MainActivity`;
    const iconNames = Object.keys(icons);

    // Remove MAIN/LAUNCHER from MainActivity so only our aliases are launcher entries.
    // This allows the default to be an alias too, so we never disable the "real" activity.
    const intentFilters = (mainActivity["intent-filter"] || []).filter(
      (filter: any) => !isMainLauncherIntentFilter(filter)
    );
    mainActivity["intent-filter"] = intentFilters;

    function createLauncherIntentFilter() {
      return [MAIN_LAUNCHER_INTENT_FILTER];
    }

    function addDefaultAlias(config: any[]): any[] {
      const defaultAlias = {
        $: {
          "android:name": `${iconNamePrefix}${DEFAULT_ALIAS_SUFFIX}`,
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

    function addIconActivityAlias(config: any[]): any[] {
      return [
        ...config,
        ...iconNames.map((iconName) => {
          const iconSrc = icons[iconName];
          const isAdaptiveIcon =
            typeof iconSrc === "object" && iconSrc !== null;

          const activityAliasAttributes: any = {
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

    function removeIconActivityAlias(config: any[]): any[] {
      return config.filter(
        (activityAlias) =>
          !(activityAlias.$["android:name"] as string).startsWith(
            iconNamePrefix
          )
      );
    }

    let activityAliases = removeIconActivityAlias(
      mainApplication["activity-alias"] || []
    );
    activityAliases = addDefaultAlias(activityAliases);
    mainApplication["activity-alias"] = addIconActivityAlias(activityAliases);

    return config;
  });
};
