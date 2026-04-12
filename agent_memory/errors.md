- **Error**: `npm start` exited with code 1 during manual user test previously.
  - **Cause**: Likely an underlying process disconnection or window focus drop.
  - **Fix**: Wrapped logic in cautious async scopes and monitoring process stability. Terminated orphaned processes.


### electron-builder winCodeSign Extract Error
- **Cause**: Windows requires Developer Mode or Admin rights to create symbolic links via 7za. electron-builder downloads winCodeSign.7z which contains `libcrypto.dylib` macOS symlinks. This throws `ERROR: Cannot create symbolic link : A required privilege is not held by the client.` during automated package builds.
- **Fix**: Code architecture is 100% correct in package.json. Local dev machines should run terminal as Administrator or enable Developer Mode in Windows to execute `npm run dist` seamlessly.
