"""
This script generates expl3.cwl and latex2e-expl3.cwl files consisting of
LaTeX 3 function and variable entries. These cwl files are then converted to
JSON by
    ts-node parse-cwl.ts both|ess|essential|expl3
"""
from pathlib import Path
import os
import re
import itertools

LATEX3_DTX = {
    'PATH_TO_DTX': os.environ.get(
        "PATH_TO_LATEX3_DTX",
        default='/opt/texlive/2024/texmf-dist/source/latex/l3kernel/'),
    'IGNORED_DTX': ['l3doc.dtx'],
    'WHITELIST_ENTRIES': [
        '\\ExplLoaderFileDate',
        '\\ExplSyntaxOff',
        '\\ExplSyntaxOn',
        '\\GetIdInfo',
        '\\ProvidesExplClass',
        '\\ProvidesExplFile',
        '\\ProvidesExplPackage'
    ],
}

LATEX2E_DTX = {
    'PATH_TO_DTX': os.environ.get(
            "PATH_TO_LATEX2E_DTX",
            default='/opt/texlive/2024/texmf-dist/source/latex/base/'),
    'IGNORED_DTX': ['doc.dtx'],
    'WHITELIST_ENTRIES': [],
}

def resolve_dtx_files(dtx_path):
    dtx_path_resolved = Path(dtx_path).resolve()
    if not dtx_path_resolved.exists():
        raise FileNotFoundError(f'Directory {dtx_path} does not exist.')
    return dtx_path_resolved.glob('*.dtx')

def exclude(entry: str) -> bool:
    # excluded patterns:
    # - begins with \:: or \__ or \@@ or \[cgl]_@@
    # - contains no _ nor :
    return not re.match(r'\\(?!(?:::)|(?:__)|(?:[cgl]_)?\@\@)', entry) \
        or not re.search(r'[_:]', entry)

def expand_variants(entry: str, options):
    if options is None:
        return [entry]
    if 'pTF' in options:
        try:
            (base, signature) = entry.split(':')
            variants = [base + '_p:' + signature]
            variants.extend([entry + v for v in ('T', 'F', 'TF')])
            return variants
        except ValueError as e:
            print(f'Wrong format for {entry} with {options}')
            print('\t', e)
            return []
    elif 'TF' in options:
        return [entry + v for v in ('T', 'F', 'TF')]
    elif 'noTF' in options:
        return [entry + v for v in ('', 'T', 'F', 'TF')]
    else:
        return [entry]


def parse_doc_block(block_content: str, _type: str):
    objs = []
    for  match in re.findall(rf'\\begin{{{_type}}}(?:\[([^\]]*)\])?[\s\n%]*{{([^}}]*)}}', block_content, flags=re.M):
        options = [o.strip() for o in match[0].split(',')]
        entries_str = match[1].replace('%', '')
        entries = [m for m in (o.strip() for o in ''.join(entries_str).split(',')) if not exclude(m)]
        expanded_entries = [x for e in entries for x in expand_variants(e, options)]
        objs.extend(expanded_entries)
    return objs


def parse_file(fpath, _type):
    objs = []
    inside_documentation = False
    block_start = None
    block_end = None
    with open(fpath, encoding='utf8') as fp:
        lines = fp.readlines()
        # content = '\n'.join(lines)
        for i, line in enumerate(lines):
            if re.search(r'\\begin{documentation}', line):
                inside_documentation = True
                block_start = i
                continue
            if not inside_documentation:
                # needed by (some of the) latex2e dtx files
                if re.search(r"\\MaybeStop", line):
                    content = ''.join(lines[:i])
                    objs.extend(parse_doc_block(content, _type))
                    break
                continue
            if inside_documentation and re.search(r'\\end{documentation}', line):
                inside_documentation = False
                block_end = i
                content = ''.join(lines[block_start:block_end])
                objs.extend(parse_doc_block(content, _type))
                break

    return objs


def parse_all_files(dtx: dict):
    entries = {}
    dtx_files = resolve_dtx_files(dtx['PATH_TO_DTX'])
    for f in dtx_files:
        print(f)
        if any(f.match(i) for i in dtx['IGNORED_DTX']):
            continue
        ans = parse_file(f.as_posix(), 'function')
        ans.extend(parse_file(f.as_posix(), 'variable'))
        if len(ans) > 0:
            entries[f.name] = list(set(ans))
    entries['whitelist'] = dtx['WHITELIST_ENTRIES']
    return entries

if __name__ == "__main__":
    # parse l3kernel dtx files then write entries to expl3.cwl file
    print("Generating expl3.cwl...")
    entries_dict = parse_all_files(LATEX3_DTX)
    entries_array = sorted(set(itertools.chain.from_iterable(entries_dict.values())))

    with open('expl3.cwl', encoding='utf8', mode='w') as fp:
        fp.writelines([e + '\n' for e in entries_array])

    # parse latex2e dtx files then write entries to latex2e-expl3.cwl file
    print("")
    print("Generating latex2e-expl3.cwl...")
    entries_dict = parse_all_files(LATEX2E_DTX)
    entries_array = sorted(set(itertools.chain.from_iterable(entries_dict.values())))

    with open('latex2e-expl3.cwl', encoding='utf8', mode='w') as fp:
        fp.writelines([e + '\n' for e in entries_array])
