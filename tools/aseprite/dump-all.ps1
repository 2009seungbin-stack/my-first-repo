param([string]$exe,[string]$corpus,[string]$outdir,[string]$rtdir)
# Runs dump.lua in real Aseprite on every corpus file and on its writer re-encoding.
$lua = Join-Path $PSScriptRoot "dump.lua"
New-Item -ItemType Directory -Force $outdir | Out-Null
$files = Get-ChildItem $corpus -Recurse -Include *.aseprite,*.ase
foreach ($f in $files) {
  $rel = $f.FullName.Substring($corpus.Length).TrimStart('\')
  $key = $rel -replace '[\\/]','__'
  foreach ($pair in @(@($f.FullName, "$outdir\$key.orig.json"), @((Join-Path $rtdir ($rel + '.rt.aseprite')), "$outdir\$key.rt.json"))) {
    $p = Start-Process -FilePath $exe -ArgumentList @("-b", "--script-param", "`"in=$($pair[0])`"", "--script-param", "`"out=$($pair[1])`"", "--script", "`"$lua`"") -NoNewWindow -PassThru -RedirectStandardOutput "$outdir\_so.txt" -RedirectStandardError "$outdir\_se.txt"
    if (-not $p.WaitForExit(60000)) { $p.Kill() }
  }
}
"done $($files.Count)"
