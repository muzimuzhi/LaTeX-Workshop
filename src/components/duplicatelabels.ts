import * as vscode from 'vscode'
import * as path from 'path'

import type {Extension} from '../main'

import { getLogger } from './logger'

const logger = getLogger('DupLabel')


export class DuplicateLabels {
    private readonly duplicatedLabelsDiagnostics = vscode.languages.createDiagnosticCollection('Duplicate Labels')

    constructor(private readonly extension: Extension) {}

    /**
     * Compute the dictionary of labels holding their file and position
     */
    private computeDuplicates(file: string): string[] {
        if (!this.extension.cacher.get(file)) {
            logger.log(`Cannot check for duplicate labels in a file not in manager: ${file} .`)
            return []
        }
        const labelsCount = new Map<string, number>()
        this.extension.cacher.getIncludedTeX().forEach(cachedFile => {
            const cachedRefs = this.extension.cacher.get(cachedFile)?.elements.reference
            if (cachedRefs === undefined) {
                return
            }
            cachedRefs.forEach(ref => {
                if (ref.range === undefined) {
                    return
                }
                let count = labelsCount.get(ref.label)
                if (count === undefined) {
                    count = 0
                }
                count += 1
                labelsCount.set(ref.label, count)
            })
        })
        const duplicates = []
        for (const [label, count] of labelsCount) {
            if (count > 1) {
                duplicates.push(label)
            }
        }
        return duplicates
    }

    run(file: string) {
        const configuration = vscode.workspace.getConfiguration('latex-workshop')
        if (!configuration.get('check.duplicatedLabels.enabled')) {
            return
        }
        logger.log(`Checking for duplicate labels: ${file} .`)
        const duplicates = this.computeDuplicates(file)
        this.showDiagnostics(duplicates)
    }

    private showDiagnostics(duplicates: string[]) {
        this.duplicatedLabelsDiagnostics.clear()
        if (duplicates.length === 0) {
            return
        }
        const diagsCollection = Object.create(null) as { [key: string]: vscode.Diagnostic[] }

        this.extension.cacher.getIncludedTeX().forEach(cachedFile => {
            const cachedRefs = this.extension.cacher.get(cachedFile)?.elements.reference
            if (cachedRefs === undefined) {
                return
            }
            cachedRefs.forEach(ref => {
                if (ref.range === undefined) {
                    return
                }
                if (duplicates.includes(ref.label)) {
                   if (! (cachedFile in diagsCollection)) {
                        diagsCollection[cachedFile] = []
                    }
                    const range = ref.range instanceof vscode.Range ? ref.range : ref.range.inserting
                    const diag = new vscode.Diagnostic(range, `Duplicate label ${ref.label}`, vscode.DiagnosticSeverity.Warning)
                    diag.source = 'DuplicateLabels'
                    diagsCollection[cachedFile].push(diag)
                }
            })
        })

        for (const file in diagsCollection) {
            if (path.extname(file) === '.tex') {
                this.duplicatedLabelsDiagnostics.set(vscode.Uri.file(file), diagsCollection[file])
            }
        }
    }

    reset() {
        this.duplicatedLabelsDiagnostics.clear()
    }
}
