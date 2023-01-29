import {EventEmitter} from 'events'
import type {PdfViewerState} from '../../types/latex-workshop-protocol-types/index'
import type {Disposable} from 'vscode'
import { getLogger } from './logger'

const logger = getLogger('Event')

export const BuildDone = 'BUILD_DONE'
export const QuickPickPrompted = 'QUICK_PICK_PROMPTED'
export const RootFileChanged = 'ROOT_FILE_CHANGED'
export const RootFileSearched = 'ROOT_FILE_SEARCHED'
export const FileParsed = 'FILE_PARSED'
export const ViewerPageLoaded = 'VIEWER_PAGE_LOADED'
export const ViewerStatusChanged = 'VIEWER_STATUS_CHANGED'
export const FileWatched = 'FILE_WATCHED'
export const FileChanged = 'FILE_CHANGED'
export const FileRemoved = 'FILE_REMOVED'
export const DocumentChanged = 'DOCUMENT_CHANGED'

type EventArgTypeMap = {
    [RootFileChanged]: string,
    [FileParsed]: string,
    [ViewerStatusChanged]: PdfViewerState,
    [FileWatched]: string,
    [FileChanged]: string,
    [FileRemoved]: string
}

export type EventName = typeof BuildDone
                    | typeof QuickPickPrompted
                    | typeof RootFileChanged
                    | typeof RootFileSearched
                    | typeof ViewerPageLoaded
                    | typeof FileParsed
                    | typeof ViewerStatusChanged
                    | typeof FileWatched
                    | typeof FileChanged
                    | typeof FileRemoved
                    | typeof DocumentChanged

export class EventBus {
    private readonly eventEmitter = new EventEmitter()

    dispose() {
        this.eventEmitter.removeAllListeners()
    }

    fire<T extends keyof EventArgTypeMap>(eventName: T, arg: EventArgTypeMap[T]): void
    fire(eventName: EventName): void
    fire(eventName: EventName, arg?: any): void {
        if (process.env['LATEXWORKSHOP_CI']) {
            logger.log(`Emitted ${eventName}.`)
        }
        this.eventEmitter.emit(eventName, arg)
    }

    // onDidChangeRootFile(cb: (rootFile: EventArgTypeMap[typeof RootFileChanged]) => void): Disposable {
    //     return this.registerListener(RootFileChanged, cb)
    // }

    // onDidEndFindRootFile(cb: () => void): Disposable {
    //     return this.registerListener(RootFileSearched, cb)
    // }

    // onDidFileParsed(cb: () => void): Disposable {
    //     return this.registerListener(FileParsed, cb)
    // }

    // onDidChangePdfViewerStatus(cb: (status: EventArgTypeMap[typeof ViewerStatusChanged]) => void): Disposable {
    //     return this.registerListener(ViewerStatusChanged, cb)
    // }

    // private registerListener<T extends keyof EventArgTypeMap>(
    //     eventName: T,
    //     cb: (arg: EventArgTypeMap[T]) => void
    // ): Disposable
    // private registerListener<T extends EventName>(
    //     eventName: T,
    //     cb: () => void
    // ): Disposable
    // private registerListener<T extends EventName>(
    //     eventName: T,
    //     cb: (arg?: any) => void
    // ): Disposable
    //  {
    //     this.eventEmitter.on(eventName, cb)
    //     const disposable = {
    //         dispose: () => { this.eventEmitter.removeListener(eventName, cb) }
    //     }
    //     return disposable
    // }

    on(eventName: EventName, cb: (arg?: any) => void): Disposable {
        this.eventEmitter.on(eventName, cb)
        const disposable = {
            dispose: () => { this.eventEmitter.removeListener(eventName, cb) }
        }
        return disposable
    }

}
