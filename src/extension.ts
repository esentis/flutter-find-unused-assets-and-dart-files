import * as fs from "fs";
import * as jsyaml from "js-yaml";
import * as path from "path";
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "unused-assets.findUnusedAssets",
    async () => {
      const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!rootPath) {
        vscode.window.showErrorMessage("No workspace is open.");
        return;
      }
      const libPath = path.join(rootPath, "lib");

      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          cancellable: false,
          title: "Finding unreferenced resources to your project...",
        },
        async (progress) => {
          progress.report({ increment: 0 });

          const [
            unreferencedAssets,
            unreferencedDependencies,
            unreferencedDartFiles,
          ] = await Promise.all([
            findUnreferencedAssets(),
            findUnreferencedDependencies(libPath),
            findUnreferencedDartFiles(),
          ]);

          displayResults(
            unreferencedAssets,
            unreferencedDependencies,
            unreferencedDartFiles
          );

          progress.report({ increment: 100 });
        }
      );
    }
  );

  context.subscriptions.push(disposable);
}

async function findUnreferencedAssets(): Promise<string[]> {
  const [assetFiles, dartFiles] = await Promise.all([
    vscode.workspace.findFiles(`assets/**/*`, `assets/fonts/**/*`, 10000),
    vscode.workspace.findFiles(`lib/**/*.dart`, null, 10000),
  ]);

  const assetNames = assetFiles.map((asset) => path.basename(asset.fsPath));

  const referencedAssets: Set<string> = new Set();

  for (const dartFile of dartFiles) {
    const dartContent = fs.readFileSync(dartFile.fsPath, "utf-8");
    for (const asset of assetNames) {
      const assetReference = `${asset}`;
      if (dartContent.includes(assetReference)) {
        referencedAssets.add(asset);
      }
    }
  }

  return assetNames.filter((asset) => !referencedAssets.has(asset));
}

async function findUnreferencedDependencies(
  libPath: string
): Promise<string[]> {
  const pubspecPath = path.join(libPath, "..", "pubspec.yaml");
  if (!fs.existsSync(pubspecPath)) {
    return [];
  }

  const pubspecContent = fs.readFileSync(pubspecPath, "utf-8");
  const pubspec = jsyaml.load(pubspecContent) as {
    dependencies: { [key: string]: string };
  };
  const dependencies = pubspec.dependencies
    ? Object.keys(pubspec.dependencies).filter(
        (dep) => dep !== "flutter" && dep !== "flutter_test"
      )
    : [];

  const dartFiles = await vscode.workspace.findFiles(
    `lib/**/*.dart`,
    null,
    10000
  );

  const referencedDependencies: Set<string> = new Set();

  for (const dartFile of dartFiles) {
    const dartContent = fs.readFileSync(dartFile.fsPath, "utf-8");
    for (const dep of dependencies) {
      const depReference = `${dep}`;

      if (dartContent.includes(depReference)) {
        referencedDependencies.add(dep);
      }
    }
  }

  return dependencies.filter((dep) => !referencedDependencies.has(dep));
}

async function findUnreferencedDartFiles(): Promise<string[]> {
  const dartFiles = await vscode.workspace.findFiles(
    `lib/**/*.dart`,
    null,
    10000
  );
  const referencedDartFiles: Set<string> = new Set();

  for (const dartFile of dartFiles) {
    const dartFileName = path.basename(dartFile.fsPath);

    for (const file of dartFiles) {
      const dartContent = fs.readFileSync(file.fsPath, "utf-8");
      if (
        file.fsPath !== dartFile.fsPath &&
        dartContent.includes(dartFileName)
      ) {
        referencedDartFiles.add(dartFileName);
      }
    }
  }

  return dartFiles
    .map((file) => path.basename(file.fsPath))
    .filter(
      (fileName) =>
        !referencedDartFiles.has(fileName) && fileName !== "main.dart"
    );
}

function displayResults(
  unreferencedAssets: string[],
  unreferencedDependencies: string[],
  unreferencedDartFiles: string[]
) {
  // Display the results in VSCode
  const outputChannel = vscode.window.createOutputChannel(
    "Unreferenced Assets"
  );

  const lineBreak: string = `---------------------------------`;
  if (unreferencedAssets.length !== 0) {
    outputChannel.appendLine(
      `(${unreferencedAssets.length}) unreferenced assets`
    );
    outputChannel.appendLine(lineBreak);
    unreferencedAssets.forEach((asset) => {
      outputChannel.appendLine(asset);
    });
  } else {
    outputChannel.appendLine("(0) unreferenced assets");
    outputChannel.appendLine(lineBreak);
  }

  if (unreferencedDependencies.length !== 0) {
    outputChannel.appendLine(
      `\n(${unreferencedDependencies.length}) unreferenced dependencies`
    );
    outputChannel.appendLine(lineBreak);
    unreferencedDependencies.forEach((dep) => {
      outputChannel.appendLine(dep);
    });
  } else {
    outputChannel.appendLine("\n(0) unreferenced dependencies");
    outputChannel.appendLine(lineBreak);
  }

  if (unreferencedDartFiles.length !== 0) {
    outputChannel.appendLine(
      `\n(${unreferencedDartFiles.length}) unreferenced dart files`
    );
    outputChannel.appendLine(lineBreak);
    unreferencedDartFiles.forEach((file) => {
      outputChannel.appendLine(file);
    });
  } else {
    outputChannel.appendLine("\n(0) unreferenced dart files");
    outputChannel.appendLine(lineBreak);
  }
  if (
    unreferencedDartFiles.length === 0 &&
    unreferencedAssets.length === 0 &&
    unreferencedDependencies.length === 0
  ) {
    outputChannel.appendLine(
      "\nNo unreferenced assets, files or dependencies !"
    );
  }
  outputChannel.show();
}
