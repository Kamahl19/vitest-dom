import {
  checkHtmlElement,
  compareArraysAsSet,
  getSingleElementValue,
} from "./utils";
import escape from "css.escape";
import { isEqualWith, uniq } from "lodash-es";
import type { MatcherResult } from "./types";

// Returns the combined value of several elements that have the same name
// e.g. radio buttons or groups of checkboxes
function getMultiElementValue(
  elements: (HTMLInputElement & { type: "radio" })[]
): string | undefined;
function getMultiElementValue(
  elements: (HTMLInputElement & { type: "checkbox" })[]
): string[];
function getMultiElementValue(elements: HTMLInputElement[]): string[];

function getMultiElementValue(elements: HTMLInputElement[]) {
  const types = uniq(elements.map((element) => element.type));
  if (types.length !== 1) {
    throw new Error(
      "Multiple form elements with the same name must be of the same type"
    );
  }
  switch (types[0]) {
    case "radio": {
      const theChosenOne = elements.find((radio) => radio.checked);
      return theChosenOne ? theChosenOne.value : undefined;
    }
    case "checkbox":
      return elements
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value);
    default:
      // NOTE: Not even sure this is a valid use case, but just in case...
      return elements.map((element) => element.value);
  }
}

type FormElement =
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement
  | HTMLButtonElement
  | HTMLMeterElement
  | HTMLProgressElement;

function getFormValue(
  container: HTMLFormElement | HTMLFieldSetElement,
  name: string
) {
  container.elements;
  const elements = [
    ...container.querySelectorAll(`[name="${escape(name)}"]`),
  ] as FormElement[];
  if (elements.length === 0) {
    return undefined; // shouldn't happen, but just in case
  }
  switch (elements.length) {
    case 1:
      return getSingleElementValue(elements[0]);
    default:
      return getMultiElementValue(elements as HTMLInputElement[]);
  }
}

// Strips the `[]` suffix off a form value name
function getPureName(name: string) {
  return /\[\]$/.test(name) ? name.slice(0, -2) : name;
}

function getAllFormValues(container: HTMLFormElement | HTMLFieldSetElement) {
  const names = Array.from(container.elements).map(
    (element) => (element as HTMLInputElement).name
  );
  return names.reduce<Record<string, unknown>>(
    (obj, name) => ({
      ...obj,
      [getPureName(name)]: getFormValue(container, name),
    }),
    {}
  );
}

export function toHaveFormValues(
  this: any,
  formElement: HTMLFormElement | HTMLFieldSetElement,
  expectedValues: Record<string, unknown>
): MatcherResult {
  checkHtmlElement(formElement, toHaveFormValues, this);
  if (!formElement.elements) {
    // TODO: Change condition to use instanceof against the appropriate element classes instead
    throw new Error("toHaveFormValues must be called on a form or a fieldset");
  }
  const formValues = getAllFormValues(formElement);
  return {
    pass: Object.entries(expectedValues).every(([name, expectedValue]) =>
      isEqualWith(formValues[name], expectedValue, compareArraysAsSet)
    ),
    message: () => {
      const to = this.isNot ? "not to" : "to";
      const matcher = `${this.isNot ? ".not" : ""}.toHaveFormValues`;
      const commonKeyValues = Object.keys(formValues)
        .filter((key) => expectedValues.hasOwnProperty(key))
        .reduce((obj, key) => ({ ...obj, [key]: formValues[key] }), {});
      return [
        this.utils.matcherHint(matcher, "element", ""),
        `Expected the element ${to} have form values`,
        this.utils.diff(expectedValues, commonKeyValues),
      ].join("\n\n");
    },
  };
}
