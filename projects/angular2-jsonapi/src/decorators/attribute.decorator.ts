import { AttributeMetadata } from '../constants/symbols';
import { AttributeDecoratorOptions } from '../interfaces/attribute-decorator-options.interface';
import { DateConverter } from '../converters/date/date.converter';
import * as _ from 'lodash';

export function Attribute(options: AttributeDecoratorOptions = {}): PropertyDecorator {
  return (target: any, propertyName: string) => {
    const converter = (dataType: any, value: any, forSerialisation = false): any => {
      let attrConverter;

      if (options.converter) {
        attrConverter = options.converter;
      } else if (dataType === Date) {
        attrConverter = new DateConverter();
      } else {
        const datatype = new dataType();
        if (datatype.mask && datatype.unmask) {
          attrConverter = datatype;
        }
      }

      if (attrConverter) {
        return !forSerialisation ? attrConverter.mask(value) : attrConverter.unmask(value);
      }

      return value;
    };

    const saveAnnotations = () => {
      const metadata = Reflect.getMetadata('Attribute', target) || {};
      metadata[propertyName] = { marked: true };
      Reflect.defineMetadata('Attribute', metadata, target);

      const mappingMetadata = Reflect.getMetadata('AttributeMapping', target) || {};
      const serializedPropertyName = options.serializedName ?? propertyName;
      mappingMetadata[serializedPropertyName] = propertyName;
      Reflect.defineMetadata('AttributeMapping', mappingMetadata, target);
    };

    saveAnnotations();

    const originalConstructor = target.constructor;

    function newConstructor(...args: any[]) {
      const instance = new originalConstructor(...args);

      // Dodanie getter i setter na poziomie instancji
      Object.defineProperty(instance, propertyName, {
        get() {
          return instance[`_${propertyName}`];
        },
        set(newVal: any) {
          const targetType = Reflect.getMetadata('design:type', target, propertyName);
          const convertedValue = converter(targetType, newVal);
          const oldValue = instance[`_${propertyName}`];

          instance[`_${propertyName}`] = convertedValue;

          if (!instance[AttributeMetadata]) {
            instance[AttributeMetadata] = {};
          }
          instance[AttributeMetadata][propertyName] = {
            newValue: convertedValue,
            oldValue,
            nested: false,
            serializedName: options.serializedName,
            hasDirtyAttributes: !_.isEqual(oldValue, convertedValue),
            serialisationValue: converter(targetType, convertedValue, true),
          };
        },
        enumerable: true,
        configurable: true,
      });

      return instance;
    }

    newConstructor.prototype = originalConstructor.prototype;
    return newConstructor;
  };
}
