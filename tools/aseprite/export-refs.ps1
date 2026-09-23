param([string]$exe,[string]$corpus,[string]$outdir,[string]$mode="aseprite")
# Exports every frame of every .ase/.aseprite under $corpus with a real editor CLI.
$files = Get-ChildItem $corpus -Recurse -Include *.aseprite,*.ase | Where-Object { $_.Name -notmatch '\.rt\.' }
$log = @()
foreach ($f in $files) {
  $rel = $f.FullName.Substring($corpus.Length).TrimStart('\')
  $d = Join-Path $outdir $rel
  New-Item -ItemType Directory -Force $d | Out-Null
  if ($mode -eq "aseprite") { $target = Join-Path $d "{frame}.png" } else { $target = Join-Path $d "0.png" }
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $p = Start-Process -FilePath $exe -ArgumentList @("-b", "`"$($f.FullName)`"", "--save-as", "`"$target`"") -NoNewWindow -PassThru -RedirectStandardOutput "$d\stdout.txt" -RedirectStandardError "$d\stderr.txt"
  if (-not $p.WaitForExit(60000)) { $p.Kill(); $log += "TIMEOUT $rel" } else { $log += "$($p.ExitCode) $($sw.ElapsedMilliseconds)ms $rel" }
}
$log | Set-Content (Join-Path $outdir "export-log.txt")
"done $($files.Count)"
