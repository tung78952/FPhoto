const { join } = require('node:path')

module.exports = async function patchWindowsIcon(context) {
  if (context.electronPlatformName !== 'win32') return

  const { rcedit } = await import('rcedit')
  const projectDir = context.packager.projectDir
  const executablePath = join(context.appOutDir, 'FPhoto.exe')
  const iconPath = join(projectDir, 'build', 'icon.ico')

  await rcedit(executablePath, {
    'version-string': {
      FileDescription: 'FPhoto',
      ProductName: 'FPhoto',
      LegalCopyright: 'Copyright © 2026 Tung',
      InternalName: 'FPhoto',
      OriginalFilename: ''
    },
    'file-version': context.packager.appInfo.version,
    'product-version': context.packager.appInfo.getVersionInWeirdWindowsForm(),
    icon: iconPath
  })
}
