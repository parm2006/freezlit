# Third-party notices

Freezlit's own source is licensed under the MIT license in LICENSE.

The Windows executable embeds Python 3.12.14 and uses pywebview 6.2.1,
pythonnet 3.2.1, clr_loader 0.3.1, cffi 2.1.1, bottle 0.13.4,
typing_extensions 4.16.0, and proxy_tools 0.1.0. It was packaged with
PyInstaller 6.22.3 and its contributed hooks 2026.8.

Original license documents copied from the installed Python runtime and
dependency distributions are preserved under third-party-licenses/.
This directory also includes notices for build dependencies and packages
in the Python build environment. PyInstaller's COPYING.txt includes its
bootloader distribution exception. The proxy_tools wheel supplied MIT
license metadata rather than a separate license text; its original
METADATA is retained.

The native window uses Microsoft Edge WebView2. pywebview ships the
WebView2 interoperability components; the Microsoft WebView2 Evergreen
Runtime is installed separately on the user's computer.

Upstream projects:

- Python: https://www.python.org/
- pywebview: https://github.com/r0x0r/pywebview
- pythonnet: https://github.com/pythonnet/pythonnet
- clr_loader: https://github.com/pythonnet/clr-loader
- PyInstaller: https://github.com/pyinstaller/pyinstaller
- WebView2: https://developer.microsoft.com/microsoft-edge/webview2/
