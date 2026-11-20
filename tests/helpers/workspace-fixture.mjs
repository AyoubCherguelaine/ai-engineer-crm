import { defaultProfile } from "../../src/lib/crm-data.js";
import {
  companyDefaults,
  contactDefaults,
} from "../../src/server/validation.js";

export function workspaceFixture() {
  return {
    profile: structuredClone(defaultProfile),
    contacts: [
      {
        ...structuredClone(contactDefaults),
        id: "fixture-person",
        name: "Fixture Person",
        companyId: "fixture-company",
      },
    ],
    companies: [
      { ...companyDefaults, id: "fixture-company", name: "Fixture Company" },
    ],
    demo: false,
  };
}
