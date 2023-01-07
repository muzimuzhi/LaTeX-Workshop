import * as vscode from 'vscode'

const LOG_PANEL = vscode.window.createOutputChannel('LaTeX Workshop')
const COMPILER_PANEL = vscode.window.createOutputChannel('LaTeX Compiler')
const STATUS_ITEM = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -10000)

COMPILER_PANEL.append('Ready')

export function getLogger(...tags: string[]) {
    const tagString = tags.map(tag => `[${tag}]`).join('')
    return {
        log(message: string) {
            logTagless(`${tagString} ${message}`)
        },
        logCommand(message: string, command: string, args: string[] = []) {
            logCommandTagless(`${tagString} ${message}`, command, args)
        },
        logError(message: string, error: unknown, stderr?: string) {
            logErrorTagless(`${tagString} ${message}`, error, stderr)
        },
        logCompiler,
        initializeStatusBarItem,
        clearCompilerMessage,
        showLog,
        showCompilerLog,
        showStatus,
        refreshStatus,
        showErrorMessage,
        showErrorMessageWithCompilerLogButton,
        showErrorMessageWithExtensionLogButton
    }
}

function logTagless(message: string) {
    const configuration = vscode.workspace.getConfiguration('latex-workshop')
    if (configuration.get('message.log.show')) {
        LOG_PANEL.appendLine(`[${new Date().toLocaleTimeString('en-US', { hour12: false })}] ${message}`)
    }
}

function logCommandTagless(message: string, command: string, args: string[] = []) {
    logTagless(`${message} The command is ${command}:${JSON.stringify(args)}.`)
}

function logErrorTagless(message: string, error: unknown, stderr?: string) {
    if (error instanceof Error) {
        logTagless(`${message} ${error.name}: ${error.message}`)
        if (error.stack) {
            logTagless(error.stack)
        }
    } else if (error instanceof Number) {
        logTagless(`${message} Exit code ${error}`)
    } else {
        logTagless(`${message} Context: ${String(error)}.`)
    }
    if (stderr) {
        logTagless(`[STDERR] ${stderr}`)
    }
}

function logCompiler(message: string) {
    COMPILER_PANEL.append(message)
}

function initializeStatusBarItem() {
    STATUS_ITEM.command = 'latex-workshop.actions'
    STATUS_ITEM.show()
    refreshStatus('check', 'statusBar.foreground')
}

function clearCompilerMessage() {
    COMPILER_PANEL.clear()
}

function showLog() {
    LOG_PANEL.show()
}

function showCompilerLog() {
    COMPILER_PANEL.show()
}

function showStatus() {
    STATUS_ITEM.show()
}

function refreshStatus(
    icon: string,
    color: string,
    message: string | undefined = undefined,
    severity: 'info' | 'warning' | 'error' = 'info',
    build: string = ''
) {
    STATUS_ITEM.text = `$(${icon})${build}`
    STATUS_ITEM.tooltip = message
    STATUS_ITEM.color = new vscode.ThemeColor(color)
    if (message === undefined) {
        return
    }
    const configuration = vscode.workspace.getConfiguration('latex-workshop')
    switch (severity) {
        case 'info':
            if (configuration.get('message.information.show')) {
                void vscode.window.showInformationMessage(message)
            }
            break
        case 'warning':
            if (configuration.get('message.warning.show')) {
                void vscode.window.showWarningMessage(message)
            }
            break
        case 'error':
        default:
            if (configuration.get('message.error.show')) {
                void vscode.window.showErrorMessage(message)
            }
            break
    }
}

function showErrorMessage(message: string, ...args: string[]): Thenable<string | undefined> | undefined {
    const configuration = vscode.workspace.getConfiguration('latex-workshop')
    if (configuration.get('message.error.show')) {
        return vscode.window.showErrorMessage(message, ...args)
    } else {
        return undefined
    }
}

function showErrorMessageWithCompilerLogButton(message: string) {
    const res = showErrorMessage(message, 'Open compiler log')
    if (res) {
        return res.then(option => {
            switch (option) {
                case 'Open compiler log': {
                    showCompilerLog()
                    break
                }
                default: {
                    break
                }
            }
        })
    }
    return
}

function showErrorMessageWithExtensionLogButton(message: string) {
    const res = showErrorMessage(message, 'Open LaTeX Workshop log')
    if (res) {
        return res.then(option => {
            switch (option) {
                case 'Open LaTeX Workshop log': {
                    showLog()
                    break
                }
                default: {
                    break
                }
            }
        })
    }
    return
}
