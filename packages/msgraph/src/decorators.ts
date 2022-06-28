import {
  DecoratorContext,
  ModelType,
  ModelTypeProperty,
  Program,
  Type,
  validateDecoratorTarget,
} from "@cadl-lang/compiler";

const openModelKey = Symbol("openModel");
/**
 * `@id` - mark a model type as open
 *
 * `@id` can only be applied to models.
 */
export function $openModel(context: DecoratorContext, entity: Type): void {
  if (!validateDecoratorTarget(context, entity, "@openModel", "Model")) {
    return;
  }

  // Register the openModel property
  context.program.stateMap(openModelKey).set(entity, true);
}

export function isOpenModel(program: Program, model: ModelType) {
  return program.stateMap(openModelKey).has(model);
}

export function getOpenModelValue(program: Program, model: ModelType): boolean {
  return program.stateMap(openModelKey).get(model);
}

const containsKey = Symbol("contains");
/**
 * `@id` - mark a model property as contained navigation property
 *
 * `@id` can only be applied to model properties.
 */
export function $contains(context: DecoratorContext, entity: Type): void {
  if (!validateDecoratorTarget(context, entity, "@contains", "ModelProperty")) {
    return;
  }

  // Register the contains property
  context.program.stateMap(containsKey).set(entity, true);
}

export function isContains(program: Program, property: ModelTypeProperty) {
  return program.stateMap(containsKey).has(property);
}

export function getContainsValue(program: Program, property: ModelTypeProperty): boolean {
  return program.stateMap(containsKey).get(property);
}

const referencesKey = Symbol("references");
/**
 * `@id` - mark a model property as contained navigation property
 *
 * `@id` can only be applied to model properties.
 */
export function $references(context: DecoratorContext, entity: Type): void {
  if (!validateDecoratorTarget(context, entity, "@references", "ModelProperty")) {
    return;
  }

  // Register the contains property
  context.program.stateMap(referencesKey).set(entity, true);
}

export function isReferences(program: Program, property: ModelTypeProperty) {
  return program.stateMap(referencesKey).has(property);
}

export function getReferencesValue(program: Program, property: ModelTypeProperty): boolean {
  return program.stateMap(referencesKey).get(property);
}
