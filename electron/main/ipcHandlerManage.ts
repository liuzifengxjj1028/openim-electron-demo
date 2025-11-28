import { BrowserWindow, Menu, Notification, app, dialog, ipcMain, shell } from "electron";
import {
  clearCache,
  closeWindow,
  minimize,
  showWindow,
  splashEnd,
  updateMaximize,
} from "./windowManage";
import { t } from "i18next";
import { IpcRenderToMain } from "../constants";
import { getStore } from "./storeManage";
import { changeLanguage } from "../i18n";

const store = getStore();

export const setIpcMainListener = () => {
  ipcMain.handle(IpcRenderToMain.clearSession, () => {
    clearCache();
  });

  // window manage
  ipcMain.handle("changeLanguage", (_, locale) => {
    store.set("language", locale);
    changeLanguage(locale).then(() => {
      app.relaunch();
      app.exit(0);
    });
  });
  ipcMain.handle("main-win-ready", () => {
    splashEnd();
  });
  ipcMain.handle(IpcRenderToMain.showMainWindow, () => {
    showWindow();
  });
  ipcMain.handle(IpcRenderToMain.minimizeWindow, () => {
    minimize();
  });
  ipcMain.handle(IpcRenderToMain.maxmizeWindow, () => {
    updateMaximize();
  });
  ipcMain.handle(IpcRenderToMain.closeWindow, () => {
    closeWindow();
  });
  ipcMain.handle(IpcRenderToMain.showMessageBox, (_, options) => {
    return dialog
      .showMessageBox(BrowserWindow.getFocusedWindow(), options)
      .then((res) => res.response);
  });

  // data transfer
  ipcMain.handle(IpcRenderToMain.setKeyStore, (_, { key, data }) => {
    store.set(key, data);
  });
  ipcMain.handle(IpcRenderToMain.getKeyStore, (_, { key }) => {
    return store.get(key);
  });
  ipcMain.on(IpcRenderToMain.getKeyStoreSync, (e, { key }) => {
    e.returnValue = store.get(key);
  });
  ipcMain.handle(IpcRenderToMain.showInputContextMenu, () => {
    const menu = Menu.buildFromTemplate([
      {
        label: t("system.copy"),
        type: "normal",
        role: "copy",
        accelerator: "CommandOrControl+c",
      },
      {
        label: t("system.paste"),
        type: "normal",
        role: "paste",
        accelerator: "CommandOrControl+v",
      },
      {
        label: t("system.selectAll"),
        type: "normal",
        role: "selectAll",
        accelerator: "CommandOrControl+a",
      },
    ]);
    menu.popup({
      window: BrowserWindow.getFocusedWindow()!,
    });
  });
  ipcMain.on(IpcRenderToMain.getDataPath, (e, key: string) => {
    switch (key) {
      case "public":
        e.returnValue = global.pathConfig.publicPath;
        break;
      case "sdkResources":
        e.returnValue = global.pathConfig.sdkResourcesPath;
        break;
      case "logsPath":
        e.returnValue = global.pathConfig.logsPath;
        break;
      default:
        e.returnValue = global.pathConfig.publicPath;
        break;
    }
  });

  // Notification settings
  ipcMain.handle(IpcRenderToMain.openNotificationSettings, () => {
    if (process.platform === "darwin") {
      // macOS: Open System Settings -> Notifications
      shell.openExternal("x-apple.systempreferences:com.apple.preference.notifications");
    } else if (process.platform === "win32") {
      // Windows: Open notification settings
      shell.openExternal("ms-settings:notifications");
    }
    // Linux: No standard way to open notification settings
  });

  ipcMain.handle(IpcRenderToMain.testNotification, async () => {
    try {
      // Test if notifications can actually be shown
      const notification = new Notification({
        title: "通知测试",
        body: "如果您看到这条通知，说明系统通知功能正常！",
        silent: true,
      });

      return new Promise((resolve) => {
        notification.on("show", () => {
          setTimeout(() => notification.close(), 3000);
          resolve({ success: true, shown: true });
        });

        notification.on("failed", (_, error) => {
          resolve({ success: false, shown: false, error });
        });

        notification.show();

        // Fallback: If no event fires, assume it didn't show
        setTimeout(() => {
          resolve({ success: false, shown: false, error: "Timeout" });
        }, 1000);
      });
    } catch (error) {
      return { success: false, shown: false, error: String(error) };
    }
  });
};
