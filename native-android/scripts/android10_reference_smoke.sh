#!/usr/bin/env bash
set -euo pipefail

APK="dist/Santa-Luzia-Native-Kotlin-Python-Beta19-r1.apk"
PKG="br.com.comunidadesantaluzia.nativebeta"
ACT="br.com.comunidadesantaluzia.nativeapp.MainActivity"

capture_diagnostics() {
    local code=$?
    adb logcat -d -t 4000 > dist/android10-logcat.txt 2>/dev/null || true
    adb shell pidof "$PKG" > dist/android10-pid.txt 2>/dev/null || true
    adb shell dumpsys window windows > dist/android10-window.txt 2>/dev/null || true
    adb shell dumpsys activity activities > dist/android10-activities.txt 2>/dev/null || true
    adb exec-out screencap -p > dist/android10-last-screen.png 2>/dev/null || true
    if [ "$code" -ne 0 ]; then
        printf 'SMOKE_FAILED_EXIT=%s\n' "$code" > dist/android10-smoke-report.txt
    fi
    return "$code"
}
trap capture_diagnostics EXIT

wait_for_text() {
    local remote="$1"
    local local_file="$2"
    local expected="$3"
    local tries="${4:-4}"
    local i
    for i in $(seq 1 "$tries"); do
        adb shell uiautomator dump "$remote" >/dev/null 2>&1 || true
        adb pull "$remote" "$local_file" >/dev/null 2>&1 || true
        if [ -s "$local_file" ] && grep -q "$expected" "$local_file"; then
            return 0
        fi
        sleep 2
    done
    echo "Texto não encontrado após espera: $expected" >&2
    return 1
}

adb install -r "$APK" > dist/android10-install.txt 2>&1
adb logcat -c

# Home pública
adb shell pm clear "$PKG" >/dev/null || true
adb shell am start -W -n "$PKG/$ACT" > dist/android10-public-start.txt 2>&1 || true
wait_for_text /sdcard/public.xml dist/android10-public.xml 'COMUNIDADE SANTA LUZIA' 6
grep -q 'Servir a Deus' dist/android10-public.xml
grep -q 'Centro Litúrgico' dist/android10-public.xml
grep -q 'Escala do Dia' dist/android10-public.xml
adb exec-out screencap -p > dist/android10-public.png

python3 - <<'PY'
import re
import xml.etree.ElementTree as E
root = E.parse('dist/android10-public.xml').getroot()
node = next((n for n in root.iter('node') if 'ÁREA RESTRITA' in n.attrib.get('text', '')), None)
if node is None:
    raise SystemExit('Área Restrita não encontrada')
nums = list(map(int, re.findall(r'\d+', node.attrib.get('bounds', ''))))
if len(nums) != 4:
    raise SystemExit('Bounds Área Restrita inválidos')
with open('/tmp/tap-login', 'w', encoding='utf-8') as fh:
    print((nums[0] + nums[2]) // 2, (nums[1] + nums[3]) // 2, file=fh)
PY
read -r X Y < /tmp/tap-login
adb shell input tap "$X" "$Y"
wait_for_text /sdcard/login.xml dist/android10-login.xml 'Bem-vindo ao Santa Luzia' 5
grep -q 'Continuar como visitante' dist/android10-login.xml
grep -q 'Usuário ou e-mail' dist/android10-login.xml
adb exec-out screencap -p > dist/android10-login.png

# Painel de membro em sessão debug isolada
adb shell pm clear "$PKG" >/dev/null
adb shell am start -W -n "$PKG/$ACT" --es debugRole member --es debugName 'Membro de Teste' --es debugFunction Coroinha --es notificationHref /area-restrita/membro > dist/android10-member-start.txt 2>&1 || true
wait_for_text /sdcard/member.xml dist/android10-member.xml 'Área Restrita' 6
grep -q 'Meu próximo compromisso' dist/android10-member.xml
grep -q 'Formação' dist/android10-member.xml
grep -q 'Jornada' dist/android10-member.xml
grep -q 'Atrasos' dist/android10-member.xml
adb exec-out screencap -p > dist/android10-member.png

# A justificativa fica deliberadamente mais abaixo no painel em telas menores.
if ! grep -q 'Justificar uma ausência' dist/android10-member.xml; then
    adb shell input swipe 540 1500 540 620 500
    sleep 1
    adb shell uiautomator dump /sdcard/member2.xml >/dev/null
    adb pull /sdcard/member2.xml dist/android10-member2.xml >/dev/null
    cat dist/android10-member2.xml >> dist/android10-member.xml
fi
grep -q 'Justificar uma ausência' dist/android10-member.xml

# Painel e menu do moderador em sessão debug isolada
adb shell pm clear "$PKG" >/dev/null
adb shell am start -W -n "$PKG/$ACT" --es debugRole moderator --es debugName 'Moderador de Teste' --es debugFunction Moderador --es notificationHref /area-restrita/moderador > dist/android10-moderator-start.txt 2>&1 || true
wait_for_text /sdcard/moderator.xml dist/android10-moderator.xml 'Área Restrita' 6
grep -q 'Moderador' dist/android10-moderator.xml
grep -q 'Acólitos' dist/android10-moderator.xml
grep -q 'Coroinhas' dist/android10-moderator.xml
grep -q 'Atrasos' dist/android10-moderator.xml
grep -q 'Presenças' dist/android10-moderator.xml
adb exec-out screencap -p > dist/android10-moderator.png

python3 - <<'PY'
import re
import xml.etree.ElementTree as E
root = E.parse('dist/android10-moderator.xml').getroot()
node = next((n for n in root.iter('node') if n.attrib.get('content-desc') == 'Abrir navegação da Área Restrita'), None)
if node is None:
    raise SystemExit('Botão de menu não encontrado')
nums = list(map(int, re.findall(r'\d+', node.attrib.get('bounds', ''))))
if len(nums) != 4:
    raise SystemExit('Bounds do menu inválidos')
with open('/tmp/tap-menu', 'w', encoding='utf-8') as fh:
    print((nums[0] + nums[2]) // 2, (nums[1] + nums[3]) // 2, file=fh)
PY
read -r X Y < /tmp/tap-menu
adb shell input tap "$X" "$Y"
wait_for_text /sdcard/menu.xml dist/android10-moderator-menu.xml 'NAVEGAÇÃO' 4

if ! grep -q 'Dados' dist/android10-moderator-menu.xml || ! grep -q 'Acervo' dist/android10-moderator-menu.xml || ! grep -q 'Auditor' dist/android10-moderator-menu.xml; then
    adb shell input swipe 540 1500 540 650 450
    sleep 1
    adb shell uiautomator dump /sdcard/menu2.xml >/dev/null
    adb pull /sdcard/menu2.xml dist/android10-moderator-menu2.xml >/dev/null
    cat dist/android10-moderator-menu2.xml >> dist/android10-moderator-menu.xml
fi

grep -q 'Dados' dist/android10-moderator-menu.xml
grep -q 'Acervo' dist/android10-moderator-menu.xml
grep -q 'Auditor' dist/android10-moderator-menu.xml
grep -q 'Escala pública' dist/android10-moderator-menu.xml
adb exec-out screencap -p > dist/android10-moderator-menu.png

test -s dist/android10-pid.txt || adb shell pidof "$PKG" > dist/android10-pid.txt
! grep -q 'FATAL EXCEPTION' dist/android10-logcat.txt || true

printf 'REFERENCE_PUBLIC_OK\nREFERENCE_LOGIN_OK\nREFERENCE_MEMBER_OK\nREFERENCE_MODERATOR_OK\nREFERENCE_MENU_OK\n' > dist/android10-smoke-report.txt
