import { exec } from "child_process";
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "unused-assets.findUnusedAssets",
    () => {
      let channel = vscode.window.createOutputChannel("Unreferenced Assets");

      const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!rootPath) {
        console.error("No workspace is open.");
        return;
      }
      const assetsPath = `${rootPath}/assets/`;
      const libPath = `${rootPath}/lib/`;

      const shellFindUnusedAssets = `cd "${rootPath}" && 
      find "${assetsPath}" -type f ! -name "*.ttf" ! -name "*.otf" -print0 | while read -d $'\\0' file; do
        name="$(basename "$file")"
        grep -rn -F -q "$name" "${libPath}"
        if [ $? -ne 0 ]; then
          echo "Unreferenced asset: $file"
        fi
      done
      `;

      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Searching for unused assets...",
          cancellable: true,
        },
        (progress, token) => {
          return new Promise((resolve, reject) => {
            exec(shellFindUnusedAssets, (error, stdout, stderr) => {
              if (error) {
                console.error(`exec error: ${error}`);
                reject();
                return;
              }

              if (token.isCancellationRequested) {
                reject();
                return;
              }

              channel.appendLine(stdout);
              channel.show();
              resolve(progress);
            });
          });
        }
      );

      const shellFindUnusedDartFiles = `cd "${rootPath}" && 
            find lib/ -name "*.dart" -print0 | while read -d $'\\0' file; do
        name="$(basename "$file")"
        grep -rn -F -q "$name" lib/
        if [ $? -ne 0 ]; then
          echo "Unreferenced file: $file"
        fi
      done`;

      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Searching for unused dart files...",
          cancellable: true,
        },
        (progress, token) => {
          return new Promise((resolve, reject) => {
            exec(shellFindUnusedDartFiles, (error, stdout, stderr) => {
              if (error) {
                console.error(`exec error: ${error}`);
                reject();
                return;
              }

              if (token.isCancellationRequested) {
                reject();
                return;
              }

              channel.appendLine(stdout);
              channel.show();
              resolve(progress);
            });
          });
        }
      );
    }
  );

  context.subscriptions.push(disposable);
}
