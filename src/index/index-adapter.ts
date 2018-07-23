import * as minimatch from 'minimatch';
import * as vscode from "vscode";
import { Logger } from '../logger';
import { FileIndex } from "./file-index";
import { IndexGroup } from "./group";
import { Index } from "./index";
import { from_vscode_Uri } from './vscode-adapter';

export interface IndexDocumentOptions {
  exclude?: string[];
}

export class IndexAdapter extends vscode.Disposable {
  private logger = new Logger("index-adapter");
  private disposables: vscode.Disposable[] = [];
  public errors: vscode.DiagnosticCollection;

  constructor(public index: Index) {
    super(() => this.dispose());

    this.disposables.push(vscode.workspace.onDidChangeWorkspaceFolders(this.onDidChangeWorkspaceFolders));
    this.errors = vscode.languages.createDiagnosticCollection("terraform-errors");
  }

  dispose() {
    this.errors.dispose();
    this.disposables.map(d => d.dispose());
  }

  private onDidChangeWorkspaceFolders(e: vscode.WorkspaceFoldersChangeEvent) {
    // TODO: remove all groups which are part e.removed[]
  }

  indexDocument(document: vscode.TextDocument, options?: IndexDocumentOptions): [FileIndex, IndexGroup] {
    if (options.exclude) {
      let path = vscode.workspace.asRelativePath(document.uri).replace('\\', '/');
      let matches = options.exclude.map((pattern) => {
        return minimatch(path, pattern);
      });
      if (matches.some((v) => v)) {
        // ignore
        this.logger.debug(`Ignoring document: ${document.uri.toString()}`);
        return;
      }
    }

    let [index, diagnostic] = FileIndex.fromString(from_vscode_Uri(document.uri), document.getText());
    let diagnostics: vscode.Diagnostic[] = [];
    let group: IndexGroup;

    if (diagnostic) {
      const range = new vscode.Range(diagnostic.range.start.line, diagnostic.range.start.character,
        diagnostic.range.end.line, diagnostic.range.end.character);
      diagnostics.push(new vscode.Diagnostic(range, diagnostic.message, vscode.DiagnosticSeverity.Error));  // TODO: actually map severity
    }

    if (index) {
      diagnostics.push(...index.diagnostics.map((d) => {
        const range = new vscode.Range(d.range.start.line, d.range.start.character,
          d.range.end.line, d.range.end.character);
        return new vscode.Diagnostic(range, d.message, vscode.DiagnosticSeverity.Error);  // TODO: actually map severity
      }));
      group = this.index.add(index);
    }

    this.errors.set(document.uri, diagnostics);
    return [index, group];
  }
}