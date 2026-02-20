package expo.modules.quickactions

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoAppIconModule : Module() {
  companion object {
    private const val TAG = "ExpoAppIcon"
    private const val MAIN_ACTIVITY_ALIAS = ".MainActivity"
    private const val ICON_PREFIX = "expo_ic_"
    /** Must match DEFAULT_ALIAS_SUFFIX in withAndroidDynamicAppIcon.ts */
    private const val DEFAULT_ALIAS_SUFFIX = "expo_ic_default"
  }

  /** Full component name for the default icon alias (used so we never disable MainActivity). */
  private val defaultAliasComponentName: String
    get() = context.packageName + MAIN_ACTIVITY_ALIAS + DEFAULT_ALIAS_SUFFIX

  override fun definition() = ModuleDefinition {
    Name("ExpoAppIcon")

    Constants(
      "isSupported" to true
    )

    Function("setIcon") { iconName: String? ->
      val mainActivityFullName = context.packageName + MAIN_ACTIVITY_ALIAS
      val currentIcon = if (SharedObject.icon.isNotEmpty()) SharedObject.icon else defaultAliasComponentName

      try {
        if (iconName == null) {
          // Reset to default: enable default alias, disable previous only if it was an alias (not MainActivity).
          if (currentIcon != mainActivityFullName) {
            disableIcon(currentIcon)
          }
          enableIcon(defaultAliasComponentName)
          SharedObject.icon = ""
          return@Function null
        } else {
          val newIcon = mainActivityFullName + ICON_PREFIX + iconName
          SharedObject.packageName = context.packageName
          SharedObject.pm = packageManager

          // 1. Enable the new alias first (so we always have at least one valid launcher entry).
          enableIcon(newIcon)

          // 2. Verify the new alias exists and is enabled before disabling the previous one.
          if (!doesComponentExist(ComponentName(context.packageName, newIcon), packageManager)) {
            Log.e(TAG, "New icon component not found: $newIcon. Not disabling previous.")
            return@Function iconName
          }
          val newState = packageManager.getComponentEnabledSetting(ComponentName(context.packageName, newIcon))
          if (newState != PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
            Log.e(TAG, "New icon component could not be enabled: $newIcon. Not disabling previous.")
            return@Function iconName
          }

          // 3. Safe to disable the previous alias (currentIcon is always an alias now, never MainActivity).
          if (currentIcon != mainActivityFullName) {
            disableIcon(currentIcon)
            SharedObject.classesToKill.add(currentIcon)
          }
          SharedObject.icon = newIcon

          return@Function iconName
        }
      } catch (e: Exception) {
        Log.e(TAG, "setIcon failed", e)
        return@Function false
      }
    }

    AsyncFunction("getIcon") {
      val currentIcon = findEnabledAlias() ?: defaultAliasComponentName
      val iconSuffix = currentIcon.substringAfter(MAIN_ACTIVITY_ALIAS, "")
      val name = if (iconSuffix.isBlank()) null else iconSuffix.removePrefix(ICON_PREFIX)
      return@AsyncFunction when {
        name == null || name == "default" -> null
        else -> name
      }
    }
  }

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React Application Context is null" }

  private val packageManager: PackageManager
    get() = requireNotNull(context.packageManager) { "Package Manager is null" }

  private fun enableIcon(alias: String) {
    packageManager.setComponentEnabledSetting(
      ComponentName(context.packageName, alias),
      PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
      PackageManager.DONT_KILL_APP
    )
  }

  private fun disableIcon(alias: String) {
    packageManager.setComponentEnabledSetting(
      ComponentName(context.packageName, alias),
      PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
      PackageManager.DONT_KILL_APP
    )
  }

  private fun findEnabledAlias(): String? {
    return try {
      val activities = packageManager.getPackageInfo(context.packageName, PackageManager.GET_ACTIVITIES).activities
      activities?.firstOrNull {
        packageManager.getComponentEnabledSetting(
          ComponentName(context.packageName, it.name)
        ) == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
      }?.name
    } catch (e: Exception) {
      Log.e(TAG, "Error getting current icon", e)
      null
    }
  }

  private fun doesComponentExist(component: ComponentName, pm: PackageManager): Boolean {
    return try {
      val packageInfo = pm.getPackageInfo(
        context.packageName,
        PackageManager.GET_ACTIVITIES or PackageManager.GET_DISABLED_COMPONENTS
      )
      packageInfo.activities?.any { it.name == component.className } == true
    } catch (e: Exception) {
      Log.e(TAG, "Error checking component existence", e)
      false
    }
  }
}
