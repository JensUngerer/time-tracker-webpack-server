export class UrlHelpers {
    public static getIdFromUlr(rawUrl: string) {
        const ONE_CHARACTER_AFTER_THE_SLASH = 1;
        const indexOfLastSlash = rawUrl.lastIndexOf('/');
        const suffix = rawUrl.substring(indexOfLastSlash + ONE_CHARACTER_AFTER_THE_SLASH);
        return suffix;
    }
}