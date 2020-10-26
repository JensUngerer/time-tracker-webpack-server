export class UrlHelpers {

  private static getStringAfterLastSlash(rawUrl: string) {
    const ONE_CHARACTER_AFTER_THE_SLASH = 1;
    const indexOfLastSlash = rawUrl.lastIndexOf('/');
    const suffix = rawUrl.substring(indexOfLastSlash + ONE_CHARACTER_AFTER_THE_SLASH);
    return suffix;
  }

  private static getPropertiesForm(urlSuffix: string) {
    const properties = urlSuffix.split('?');

    // DEBUGGING
    // console.log(properties);

    return properties;
  }

  public static getIdFromUlr(rawUrl: string) {
    const suffix = UrlHelpers.getStringAfterLastSlash(rawUrl);
    return suffix;
  }

  public static getProperty(rawUrl: string, propertyName: string) {
    // const suffix = UrlHelpers.getStringAfterLastSlash(rawUrl);
    // const properties = UrlHelpers.getPropertiesForm(suffix);

    // return properties[propertyName]

    const suffix = UrlHelpers.getStringAfterLastSlash(rawUrl);

    // DEBUGGING:
    // console.log(suffix);

    const properties = UrlHelpers.getPropertiesForm(suffix);
    const foundPropertyKeyValuePair = properties.find((onePropertyKeyValuePair: string) => {
      return onePropertyKeyValuePair.includes(propertyName);
    });
    if (!foundPropertyKeyValuePair) {
      return null;
    }

    // DEBUGGING
    // console.log(foundPropertyKeyValuePair);

    const indexOfEqualSign = foundPropertyKeyValuePair.indexOf('=');
    if (indexOfEqualSign === -1) {
      return null;
    }
    const ONE_CHARACTER_AFTER_THE_EQUAL_SIGN = 1;
    const propertyValue = foundPropertyKeyValuePair.substr(indexOfEqualSign + ONE_CHARACTER_AFTER_THE_EQUAL_SIGN);
    if (!propertyValue) {
      return null;
    }
    return propertyValue.toString();
  }

  public static getDateObjFromUrl(rawUrl: string, propertyName: string) {
    const propertyValue = UrlHelpers.getProperty(rawUrl, propertyName);
    if (propertyValue === null) {
      return null;
    }

    // DEBUGGING:
    // console.log(propertyValue);

    return new Date(parseFloat(propertyValue));
  }
}
