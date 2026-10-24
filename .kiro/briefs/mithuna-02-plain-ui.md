Read .plans/rxgene-build-spec.md section 7.

Build a plain, functional UI in web/src/components/. No styling work yet, because a design arrives later.
- PatientPicker using the 8 preset patients from the spec section 7 table. Put them in web/src/data/patients.ts.
- MedList with add/remove, and a search box over: the drugs in data/cpic/recommendations, every drug in data/inhibitors.json, and acetaminophen and ibuprofen (uncovered drugs, which should show GREY).
- One AlertCard per assessment from checkOrder. Each card shows the headline, genotype phenotype vs adjusted phenotype, the confidence flag, the inhibitor note, and the CPIC recommendation.
- Use the UI wording table in docs/PLAN-v3.md. GREEN shows "No supported alert (not the same as safe)".
Demo cases Sarah, Marcus and Priya must work. Don't run git. When you finish, list the files you created.
