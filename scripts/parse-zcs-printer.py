import glob
import os
import re
import subprocess

dex = os.path.join(os.environ["TEMP"], "z91-apk", "smartpos-ex", "classes.dex")
dexdump = sorted(glob.glob(r"C:\Users\VENTS\AppData\Local\Android\Sdk\build-tools\*\dexdump.exe"))[-1]
out = subprocess.check_output([dexdump, "-d", dex], stderr=subprocess.STDOUT, text=True, errors="ignore")

def dump_class(class_name: str, label: str) -> None:
    m = re.search(
        rf"Class descriptor  : '{class_name}'.*?Virtual methods   -(.*?)  source_file",
        out,
        re.S,
    )
    if not m:
        print(f"{label}: not found")
        return
    print(f"=== {label} ===")
    for name, typ in re.findall(r"name\s+: '([^']+)'.*?type\s+: '([^']+)'", m.group(1), re.S):
        if "Prn" in name or "prn" in name.lower() or "String" in typ or typ.endswith("()I"):
            print(f"  {name} {typ}")

dump_class("Lcom/zcs/sdk/g;", "Printer (com.zcs.sdk.g)")
dump_class("Lcom/zcs/base/SmartPosJni;", "SmartPosJni")

m = re.search(
    r"Class descriptor  : 'Lcom/zcs/sdk/DriverManager;'.*?Direct methods   -(.*?)  Virtual methods",
    out,
    re.S,
)
print("=== DriverManager static ===")
if m:
    for name, typ in re.findall(r"name\s+: '([^']+)'.*?type\s+: '([^']+)'", m.group(1), re.S):
        print(f"  {name} {typ}")
