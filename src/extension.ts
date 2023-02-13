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

      const shellFindUnusedDependencies = `cd "${rootPath}" && 
      while read line
      do
          if [ "$line" == "dependencies:" ]
          then
              while read -r line && [ "$line" != "" ]
              do
                  dependency_name=$(echo "$line" | sed -e 's/[ \t]*//')
                  if [[ $dependency_name =~ .*: ]]; then
                      dependency_name="\${dependency_name%:*}"
                  fi
                  if [ "$dependency_name" != "flutter" ] && [ "$dependency_name" != "sdk" ] && [ "$dependency_name" != "version" ]; then
                      dependency_names+=( "$dependency_name" )
                  fi
              done
          fi
      done < "pubspec.yaml"
      
      echo ""
      echo "Total \${#dependency_names[@]} dependencies found in pubspec.yaml"
      echo ""
      
      for dep in "\${dependency_names[@]}"; do
          count=$(grep -R "import.*$dep" lib/ | wc -l)
          if [ $count -eq 0 ]; then
              echo "Dependency $dep is not imported in any .dart file in lib/ folder"
          fi
      done
      `;

      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Searching for unreferenced dependencies...",
          cancellable: true,
        },
        (progress, token) => {
          return new Promise((resolve, reject) => {
            exec(shellFindUnusedDependencies, (error, stdout, stderr) => {
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
