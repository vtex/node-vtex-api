import semver from 'semver'

import { AppMetaInfo } from '../clients/Apps'

// Note: The name that composes the part of the appId that precedes the
// character '@' includes the name given to the app and the vendor name.

export const removeBuild = (id: string): string => id.split('+')[0]

export const removeVersionFromAppId = (appId: string): string => appId.split('@')[0]

export const extractVersionFromAppId = (appId: string): string => appId.split('@').slice(-1)[0]

export const transformToLinkedLocator = (appId: string) => appId.replace(/\+build.*$/, '+linked')

export const formatLocator = (name: string, versionAndBuild: string): string => `${name}@${removeBuild(versionAndBuild)}`

export const isLinkedApp = (app: AppMetaInfo) => app.id.includes('+build')

export const parseAppId = (appId: string): ParsedLocator => {
  const name = removeVersionFromAppId(appId)
  const version = extractVersionFromAppId(appId)
  const splittedVersion = version.split('+')
  return {
    build: splittedVersion[1],
    locator: formatLocator(name, version),
    name,
    version: splittedVersion[0],
  }
}

export const formatAppId = ({locator, build}: ParsedLocator) => build ? `${locator}+${build}` : locator

export const satisfies = (appId: string, version: string): boolean => {
  const {version: appVer} = parseAppId(appId)
  return semver.satisfies(appVer, version)
}

export const versionToMajor = (version: string): string => version.split('.')[0]

export const versionToMajorRange = (version: string): string => `${versionToMajor(version)}.x`

export const formatMajorLocator = (name: string, version: string): string => {
  const majorRange = versionToMajorRange(version)
  return `${name}@${majorRange}`
}

export const appIdToAppAtMajor = (appId: string): string => {
  const {name, version} = parseAppId(appId)
  const majorRange = versionToMajorRange(version)
  return `${name}@${majorRange}`
}

// SemVer regex from https://github.com/sindresorhus/semver-regex
const APP_ID_REGEX = /^[\w-]+\.[\w-]+@(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\da-z-]+(?:\.[\da-z-]+)*)?(?:\+[\da-z-]+(?:\.[\da-z-]+)*)?$/

export const isValidAppIdOrLocator = (appId: string): boolean => {
  return APP_ID_REGEX.test(appId)
}

export interface ParsedLocator {
  name: string
  version: string
  locator: string
  build?: string
}
