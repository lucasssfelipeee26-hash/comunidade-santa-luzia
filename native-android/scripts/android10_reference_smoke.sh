#!/usr/bin/env bash
set -euo pipefail

APK="dist/Santa-Luzia-Native-Kotlin-Python-Beta19-r1.apk"
PKG="br.com.comunidadesantaluzia.nativebeta"
ACT="br.com.comunidadesantaluzia.nativeapp.MainActivity"

adb install -r "$APK" > dist/android10-install.txt 2>&1
adb logcat -c

# Home pública
adb shell pm clear "$PKG" >/dev/null || true
adb shell am start -W -n "$PKG/$ACT" > dist/android10-public-start.txt 2>&1
sleep 4
adb shell uiautomator dump /sdcard/public.xml >/dev/null
adb pull /sdcard/public.xml dist/android10-public.xml >/dev/null
grep -q 'COMUNIDADE SANTA LUZIA' dist/android10-public.xml
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
sleep 2
adb shell uiautomator dump /sdcard/login.xml >/dev/null
adb pull /sdcard/login.xml dist/android10-login.xml >/dev/null
grep -q 'Bem-vindo ao Santa Luzia' dist/android10-login.xml
grep -q 'Continuar como visitante' dist/android10-login.xml
grep -q 'Usuário ou e-mail' dist/android10-login.xml
adb exec-out screencap -p > dist/android10-login.png

# Painel de membro em sessão debug isolada
adb shell pm clear "$PKG" >/dev/null
adb shell am start -W -n "$PKG/$ACT" --es debugRole member --es debugName 'Membro de Teste' --es debugFunction Coroinha --es notificationHref /area-restrita/membro > dist/android10-member-start.txt 2>&1
sleep 5
adb shell uiautomator dump /sdcard/member.xml >/dev/null
adb pull /sdcard/member.xml dist/android10-member.xml >/dev/null
grep -q 'Área Restrita' dist/android10-member.xml
grep -q 'Meu próximo compromisso' dist/android10-member.xml
grep -q 'Formação' dist/android10-member.xml
grep -q 'Jornada' dist/android10-member.xml
grep -q 'Atrasos' dist/android10-member.xml
grep -q 'Justificar uma ausência' dist/android10-member.xml
adb exec-out screencap -p > dist/android10-member.png

# Painel e menu do moderador em sessão debug isolada
adb shell pm clear "$PKG" >/dev/null
adb shell am start -W -n "$PKG/$ACT" --es debugRole moderator --es debugName 'Moderador de Teste' --es debugFunction Moderador --es notificationHref /area-restrita/moderador > dist/android10-moderator-start.txt 2>&1
sleep 5
adb shell uiautomator dump /sdcard/moderator.xml >/dev/null
adb pull /sdcard/moderator.xml dist/android10-moderator.xml >/dev/null
grep -q 'Área Restrita' dist/android10-moderator.xml
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
sleep 1
adb shell uiautomator dump /sdcard/menu.xml >/dev/null
adb pull /sdcard/menu.xml dist/android10-moderator-menu.xml >/dev/null

# O menu é rolável. Capture a primeira página e, se necessário, role para validar
# itens administrativos que ficam abaixo da dobra em telas menores.
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

adb shell pidof "$PKG" > dist/android10-pid.txt
adb logcat -d -t 2400 > dist/android10-logcat.txt
test -s dist/android10-pid.txt
! grep -q 'FATAL EXCEPTION' dist/android10-logcat.txt

printf 'REFERENCE_PUBLIC_OK\nREFERENCE_LOGIN_OK\nREFERENCE_MEMBER_OK\nREFERENCE_MODERATOR_OK\nREFERENCE_MENU_OK\n' > dist/android10-smoke-report.txt
