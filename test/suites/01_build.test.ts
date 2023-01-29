import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import rimraf from 'rimraf'
import * as lw from '../../src/lw'
import * as test from './utils'
import { BuildDone, QuickPickPrompted } from '../../src/components/eventbus'
import assert from 'assert'

suite('Build TeX files test suite', () => {

    const suiteName = path.basename(__filename).replace('.test.js', '')
    let fixture = path.resolve(__dirname, '../../../test/fixtures/testground')
    const fixtureName = 'testground'

    suiteSetup(() => {
        fixture = path.resolve(lw.extensionRoot, 'test/fixtures/testground')
    })

    setup(async () => {
        await vscode.commands.executeCommand('latex-workshop.activate')

        const tools = [{ name: 'latexmk', command: 'echo', args: ['"%OUTDIR%"', '"%DOC%"'], env: {} }]
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.tools', tools)
    })

    teardown(async () => {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors')
        lw.manager.rootFile = undefined
        lw.manager.localRootFile = undefined
        lw.completer.input.reset()
        lw.duplicateLabels.reset()
        lw.cacher.allPaths.forEach(filePath => lw.cacher.remove(filePath))
        await lw.cacher.resetWatcher()

        await vscode.workspace.getConfiguration('latex-workshop').update('latex.tools', undefined)
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.outDir', undefined)
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.recipes', undefined)
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.magic.args', undefined)
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.build.forceRecipeUsage', undefined)
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.rootFile.doNotPrompt', undefined)
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.rootFile.useSubFile', undefined)
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.search.rootFiles.include', undefined)
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.search.rootFiles.exclude', undefined)
    })

    suiteTeardown(async () => {
        if (path.basename(fixture) === 'testground') {
            rimraf(fixture + '/{*,.vscode/*}', (e) => {if (e) {console.error(e)}})
            await test.sleep(500) // Required for pooling
        }
    })

    test.run(suiteName, fixtureName, 'basic build', async () => {
        await test.loadAndCache(fixture, [
            {src: 'base.tex', dst: 'main.tex'}
        ])
        await test.assert.echo({fixture, openFile: 'main.tex'})
    })

    test.run(suiteName, fixtureName, 'same placeholders multiple times', async () => {
        const tools = [{ name: 'latexmk', command: 'echo', args: ['"%OUTDIR%"', '"%DOC%"', '"%DOC%"', '"%DOC%"'], env: {} }]
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.tools', tools)
        await test.loadAndCache(fixture, [
            {src: 'base.tex', dst: 'main.tex'}
        ])
        const args = await test.assert.echo({fixture, openFile: 'main.tex'})
        assert.strictEqual(args.length, 4)
        assert.strictEqual(path.relative(args[2], path.resolve(fixture, 'main').replaceAll(path.win32.sep, '/')), '')
        assert.strictEqual(path.relative(args[3], path.resolve(fixture, 'main').replaceAll(path.win32.sep, '/')), '')
    })

    test.run(suiteName, fixtureName, 'auto-detect subfile root and build 1', async () => {
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.rootFile.doNotPrompt', true)
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.rootFile.useSubFile', true)
        await test.loadAndCache(fixture, [
            {src: 'subfile_base.tex', dst: 'main.tex'},
            {src: 'subfile_sub.tex', dst: 'sub/s.tex', localRoot: true}
        ])
        await test.assert.echo({fixture, openFile: 'sub/s.tex', outDir: path.resolve(fixture, 'sub')})
    })

    test.run(suiteName, fixtureName, 'auto-detect subfile root and build 2', async () => {
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.rootFile.doNotPrompt', true)
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.rootFile.useSubFile', false)
        await test.loadAndCache(fixture, [
            {src: 'subfile_base.tex', dst: 'main.tex'},
            {src: 'subfile_sub.tex', dst: 'sub/s.tex', localRoot: true}
        ])
        await test.assert.echo({fixture, openFile: 'sub/s.tex', baseFile: 'main.tex'})
    })

    test.run(suiteName, fixtureName, 'build with outDir', async () => {
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.outDir', './out')
        await test.loadAndCache(fixture, [
            {src: 'base.tex', dst: 'main.tex'}
        ])
        await test.assert.echo({fixture, openFile: 'main.tex', outDir: 'out'})
    })

    test.run(suiteName, fixtureName, 'basic build with spaces in names', async () => {
        await test.loadAndCache(fixture, [
            {src: 'base.tex', dst: 'main space/main.tex'}
        ])
        await test.assert.echo({fixture, openFile: 'main space/main.tex', outDir: path.resolve(fixture, 'main space'), cwdPath: '%WS1%/main space'})
    })

    test.run(suiteName, fixtureName, 'basic build with spaces in outdir', async () => {
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.outDir', '%DIR%/out space')
        await test.loadAndCache(fixture, [
            {src: 'base.tex', dst: 'main.tex'
        }])
        await test.assert.echo({fixture, openFile: 'main.tex', outDir: path.resolve(fixture, 'out space')})
    })

    test.run(suiteName, fixtureName, 'build with magic comment ', async () => {
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.recipes', [])
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.magic.args', ['"%OUTDIR%"', '"%DOC%"'])
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.build.forceRecipeUsage', false)
        await test.loadAndCache(fixture, [
            {src: 'magic_program.tex', dst: 'main.tex'}
        ])
        await test.assert.echo({fixture, openFile: 'main.tex'})
    })

    test.run(suiteName, fixtureName, 'build with !TEX program and !TEX options', async () => {
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.recipes', [])
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.build.forceRecipeUsage', false)
        await test.loadAndCache(fixture, [
            {src: 'magic_option.tex', dst: 'main.tex'}
        ])
        await test.assert.echo({fixture, openFile: 'main.tex'})
    })

    test.run(suiteName, fixtureName, 'build with invalid !TEX program', async () => {
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.build.forceRecipeUsage', false)
        await test.loadAndCache(fixture, [
            {src: 'magic_invalid.tex', dst: 'main.tex'
        }])
        await test.assert.echo({fixture, openFile: 'main.tex', noBuild: true})
    })

    test.run(suiteName, fixtureName, 'build with forceRecipeUsage: true', async () => {
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.build.forceRecipeUsage', true)
        await test.loadAndCache(fixture, [
            {src: 'magic_invalid.tex', dst: 'main.tex'}
        ])
        await test.assert.echo({fixture, openFile: 'main.tex'})
    })

    test.run(suiteName, fixtureName, 'build a subfile when main.tex opened', async () => {
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.rootFile.doNotPrompt', true)
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.rootFile.useSubFile', true)
        await test.loadAndCache(fixture, [
            {src: 'subfile_base.tex', dst: 'main.tex'},
            {src: 'subfile_sub.tex', dst: 'sub/s.tex', localRoot: true}
        ])

        const docMain = await vscode.workspace.openTextDocument(vscode.Uri.file(path.resolve(fixture, 'main.tex')))
        await vscode.window.showTextDocument(docMain)
        const docSub = await vscode.workspace.openTextDocument(vscode.Uri.file(path.resolve(fixture, 'sub/s.tex')))
        await vscode.window.showTextDocument(docSub, vscode.ViewColumn.Beside)
        lw.manager.localRootFile = path.resolve(fixture, 'sub/s.tex')

        await test.assert.echo({fixture, openFile: 'sub/s.tex', outDir: path.resolve(fixture, 'sub')})
    })//, ['linux', 'darwin']) // Skip win for very high false alarm rate

    test.run(suiteName, fixtureName, 'build main.tex with QuickPick', async () => {
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.rootFile.doNotPrompt', false)
        await test.loadAndCache(fixture, [
            {src: 'subfile_base.tex', dst: 'main.tex'},
            {src: 'subfile_sub.tex', dst: 'sub/s.tex', localRoot: true}
        ])
        await test.assert.echo({fixture, openFile: 'sub/s.tex', baseFile: 'main.tex', action: async () => {
            const done = {build: test.wait(BuildDone), pick: test.wait(QuickPickPrompted)}
            void lw.commander.build({uri: vscode.Uri.file(path.resolve(fixture, 'sub/s.tex')), langId: 'latex'})
            await done.pick
            await vscode.commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem')
            await done.build
        }})
    })

    test.run(suiteName, fixtureName, 'build s.tex with QuickPick', async () => {
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.rootFile.doNotPrompt', false)
        await test.loadAndCache(fixture, [
            {src: 'subfile_base.tex', dst: 'main.tex'},
            {src: 'subfile_sub.tex', dst: 'sub/s.tex', localRoot: true}
        ])
        await test.assert.echo({fixture, openFile: 'sub/s.tex', outDir: path.resolve(fixture, 'sub'), action: async () => {
            const done = {build: test.wait(BuildDone), pick: test.wait(QuickPickPrompted)}
            void lw.commander.build({uri: vscode.Uri.file(path.resolve(fixture, 'sub/s.tex')), langId: 'latex'})
            await done.pick
            await vscode.commands.executeCommand('workbench.action.quickOpenSelectNext')
            await test.sleep(500)
            await vscode.commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem')
            await done.build
        }})
    })//, ['linux', 'darwin']) // Skip win for very high false alarm rate

    test.run(suiteName, fixtureName, 'build sub.tex to outdir', async () => {
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.rootFile.doNotPrompt', true)
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.outDir', './out')
        await test.loadAndCache(fixture, [
            {src: 'subfile_base.tex', dst: 'main.tex'},
            {src: 'subfile_subsub.tex', dst: 'sub/s.tex', localRoot: true},
            {src: 'plain.tex', dst: 'sub/subsub/infile.tex'}
        ])
        await test.assert.echo({fixture, openFile: 'sub/s.tex', outDir: 'out'})
    })

    test.run(suiteName, fixtureName, 'test q/.../ with spaces in outdir on Windows', async () => {
        const tools = [{ name: 'latexmk', command: 'latexmk', args: ['-e', '$pdflatex=q/pdflatex %O -synctex=1 -interaction=nonstopmode -file-line-error %S/', '-outdir=%OUTDIR%', '-pdf', '%DOC%'], env: {} }]
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.tools', tools)
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.outDir', '%DIR%/out space 1')
        await test.loadAndCache(fixture, [
            {src: 'base.tex', dst: 'main.tex'}
        ])
        await lw.commander.build({uri: vscode.Uri.file(path.resolve(fixture, 'main.tex')), langId: 'latex'})
        assert.ok(fs.existsSync(path.join(fixture, 'out space 1/main.pdf')))
    }, ['win32'])

    test.run(suiteName, fixtureName, 'test q/.../ with copy and remove on Windows', async () => {
        const tools = [
            { name: 'latexmk', command: 'latexmk', args: ['-e', '$pdflatex=q/pdflatex %O -synctex=1 -interaction=nonstopmode -file-line-error %S/', '-outdir=%OUTDIR%', '-pdf', '%DOC%'], env: {} },
            {name: 'copyPDF', command: 'copy', args: ['%OUTDIR_W32%\\%DOCFILE%.pdf', '%OUTDIR_W32%\\copy.pdf'], env: {}},
            {name: 'removePDF', command: 'del', args: ['%OUTDIR_W32%\\%DOCFILE%.pdf'], env: {}}
        ]
        const recipes = [{name: 'latexmk_copy', tools: ['latexmk', 'copyPDF', 'removePDF']}]
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.tools', tools)
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.recipes', recipes)
        await vscode.workspace.getConfiguration('latex-workshop').update('latex.outDir', '%DIR%/out space 2')
        await test.loadAndCache(fixture, [
            {src: 'base.tex', dst: 'main.tex'}
        ])
        await lw.commander.build({uri: vscode.Uri.file(path.resolve(fixture, 'main.tex')), langId: 'latex'})
        assert.ok(fs.existsSync(path.join(fixture, 'out space 2/copy.pdf')))
    }, ['win32'])

})
