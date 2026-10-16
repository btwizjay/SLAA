"use client";
import { useState } from "react";
import { ActionForm } from "./ActionForm";
import { EventRows, type EventRow } from "@/components/EventRows";
import { DISTRICTS, EVENTS } from "@/lib/reference";
import { editProfile } from "@/app/admin/(staff)/suite-actions";
export type ProfileValues = {
  slaaId: string;
  version: string;
  fullName: string;
  nameWithInitials: string;
  nic: string;
  postalId: string;
  dateOfBirth: string;
  gender: string;
  district: string;
  phone: string;
  email: string;
  athlete: boolean;
  coach: boolean;
  schoolOrClub: string;
  licenseNo: string;
  licenseLevel: string;
  disciplines: string[];
  events: EventRow[];
  guardian: {
    fullName: string;
    relationship: string;
    phone: string;
    nic: string;
  } | null;
};
export function EditProfile({ value: v }: { value: ProfileValues }) {
  const [events, setEvents] = useState(v.events);
  const [identityType, setIdentityType] = useState(v.nic ? "nic" : "postal");
  const input = (name: string, label: string, value: string, type = "text") => (
    <label key={name} className="text-sm">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        maxLength={name === "fullName" ? 160 : 254}
        className="mt-1 h-11 w-full rounded-lg border px-3"
      />
    </label>
  );
  return (
    <details className="rounded-xl border bg-background p-5">
      <summary className="cursor-pointer font-semibold text-primary">
        Edit member details and events
      </summary>
      <ActionForm
        action={editProfile}
        submit="Save member changes"
        className="mt-5"
      >
        <input type="hidden" name="slaaId" value={v.slaaId} />
        <input type="hidden" name="version" value={v.version} />
        <input type="hidden" name="events" value={JSON.stringify(events)} />
        <div className="grid gap-4 sm:grid-cols-2">
          {input("fullName", "Full name", v.fullName)}
          {input("nameWithInitials", "Name with initials", v.nameWithInitials)}
          <label className="text-sm">
            Identity type
            <select
              name="identityType"
              value={identityType}
              onChange={(e) => setIdentityType(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border px-3"
            >
              <option value="nic">NIC</option>
              <option value="postal">Postal ID</option>
            </select>
          </label>
          {identityType === "nic"
            ? input("nic", "NIC number", v.nic)
            : input("postalId", "Postal ID number", v.postalId)}
          {input(
            "dateOfBirth",
            "Date of birth (derived from NIC when used)",
            v.dateOfBirth,
            "date",
          )}
          <label className="text-sm">
            Gender
            <select
              name="gender"
              defaultValue={v.gender}
              className="mt-1 h-11 w-full rounded-lg border px-3"
            >
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </label>
          <label className="text-sm">
            District
            <select
              name="district"
              defaultValue={v.district}
              className="mt-1 h-11 w-full rounded-lg border px-3"
            >
              {DISTRICTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          {input("phone", "Mobile number", v.phone, "tel")}
          {input("email", "Email", v.email, "email")}
          {v.athlete && input("schoolOrClub", "School or club", v.schoolOrClub)}
        </div>
        {v.athlete && (
          <section className="space-y-3 border-t pt-4">
            <h3 className="font-semibold">Events and personal bests</h3>
            <EventRows value={events} onChange={setEvents} />
          </section>
        )}
        {v.athlete && (
          <fieldset className="grid gap-3 border-t pt-4 sm:grid-cols-2">
            <legend className="font-semibold">
              Guardian details (required for minors)
            </legend>
            {input("guardianName", "Guardian name", v.guardian?.fullName ?? "")}
            {input(
              "guardianRelationship",
              "Guardian relationship",
              v.guardian?.relationship ?? "",
            )}
            {input(
              "guardianPhone",
              "Guardian mobile",
              v.guardian?.phone ?? "",
              "tel",
            )}
            {input(
              "guardianNic",
              "Guardian NIC (optional)",
              v.guardian?.nic ?? "",
            )}
            <label className="flex items-start gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                name="guardianConsent"
                defaultChecked={!!v.guardian}
                className="mt-1"
              />
              I have checked the guardian authorization for these details.
            </label>
          </fieldset>
        )}
        {v.coach && (
          <fieldset className="space-y-3 border-t pt-4">
            <legend className="font-semibold">Coach profile</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {input("licenseNo", "SLAA licence number", v.licenseNo)}
              {input("licenseLevel", "Licence level", v.licenseLevel)}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {EVENTS.map((e) => (
                <label key={e.code} className="flex items-center gap-2 text-sm">
                  <input
                    name="disciplines"
                    value={e.code}
                    type="checkbox"
                    defaultChecked={v.disciplines.includes(e.code)}
                  />
                  {e.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <label className="text-sm font-medium">
          Reason for correction
          <textarea
            name="reason"
            required
            maxLength={500}
            rows={2}
            className="mt-1 w-full rounded-lg border p-3"
          />
        </label>
      </ActionForm>
    </details>
  );
}
