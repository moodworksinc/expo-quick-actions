import { ConfigPlugin } from "@expo/config-plugins";
import { AdaptiveIcon } from "./withAndroidAppIcon";
/** Alias name for the default app icon. Must match ExpoAppIconModule.DEFAULT_ALIAS_SUFFIX in Kotlin. */
export declare const DEFAULT_ALIAS_SUFFIX = "expo_ic_default";
type Props = {
    icons: Record<string, string | AdaptiveIcon>;
};
export declare const withAndroidDynamicAppIcons: ConfigPlugin<Props>;
export {};
