# Server release How-To

To release the server:

- [ ] Bump the version in `package.json`
- [ ] Generate a new changelog with:
  - `./bin/generate-commit-log --write recent`
- [ ] Commit version change and changelog
- [ ] Tag with `git tag VERSION`
- [ ] Push version and tags, `git push && git push --tags`
- [ ] Merge to `server-prod`:
  - `git checkout server-prod && git merge master && git push`
  - This will trigger a deploy to stage
  - IRC will get updates
  - https://screenshots.stage.mozaws.net/__version__ will show the status
- [ ] Ping relud on IRC to deploy to prod
  - https://screenshots.firefox.com/__version__ will show the status
  - IRC will get updates

Note if someone needs to re-deploy the last stage deployment (e.g., some dependent resource has been updated), then going to the [CircleCI server-prod builds](https://circleci.com/gh/mozilla-services/screenshots/tree/server-prod), finding the latest build, and "rebuilding" it should trigger a redeployment of stage.
