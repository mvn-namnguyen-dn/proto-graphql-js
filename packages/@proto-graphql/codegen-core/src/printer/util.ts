import { ProtoEnum, ProtoField, ProtoMessage } from "@proto-graphql/proto-descriptors";
import { camelCase } from "change-case";
import * as path from "path";
import { code, Code, imp } from "ts-poet";
import {
  EnumType,
  InputObjectField,
  InputObjectType,
  InterfaceType,
  ObjectField,
  ObjectOneofField,
  ObjectType,
  OneofUnionType,
  PrinterOptions,
  protoImportPath,
  SquashedOneofUnionType,
} from "../types";

export function filename(
  type: ObjectType | InputObjectType | EnumType | OneofUnionType | SquashedOneofUnionType | InterfaceType,
  opts: Pick<PrinterOptions, "fileLayout">
): string {
  switch (opts.fileLayout) {
    case "proto_file":
      return type.file.filename;
    case "graphql_type": {
      return path.join(path.dirname(type.file.filename), `${type.typeName}${type.file.extname}`);
    }
    /* istanbul ignore next */
    default: {
      const _exhaustiveCheck: never = opts.fileLayout;
      throw "unreachable";
    }
  }
}

export function generatedGraphQLTypeImportPath(
  field:
    | ObjectField<ObjectType | EnumType | InterfaceType | SquashedOneofUnionType>
    | InputObjectField<InputObjectType | EnumType>
    | ObjectOneofField,
  opts: PrinterOptions
): string | null {
  if (field instanceof ObjectOneofField) return null;
  const [fromPath, toPath] = [filename(field.parent, opts), filename(field.type, opts)].map((f) =>
    path.isAbsolute(f) ? `.${path.sep}${f}` : f
  );

  if (fromPath === toPath) return null;

  const importPath = path.relative(path.dirname(fromPath), toPath).replace(/\.ts$/, "");
  return importPath.match(/^[\.\/]/) ? importPath : `./${importPath}`;
}

/** Remove nullish values recursively. */
export function compact(v: any): any {
  if (typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(compact);
  if (v == null) return v;
  if ("toCodeString" in v) return v; // ignore nodes of ts-poet
  return compactObj(v);
}

function compactObj<In extends Out, Out extends Record<string, unknown>>(obj: In): Out {
  return Object.keys(obj).reduce((newObj, key) => {
    const v = obj[key];
    return v == null ? newObj : { ...newObj, [key]: compact(v) };
  }, {} as Out);
}

export function protoType(origProto: ProtoMessage | ProtoEnum | ProtoField, opts: PrinterOptions): Code {
  const origProtoType = origProto.kind === "Field" ? origProto.type : origProto;
  if (origProtoType.kind === "Scalar") {
    throw new Error("cannot import protobuf primitive types");
  }
  let proto = origProtoType;
  const chunks = [proto.name];
  while (proto.parent.kind !== "File") {
    proto = proto.parent;
    chunks.unshift(proto.name);
  }
  switch (opts.protobuf) {
    case "google-protobuf": {
      return code`${imp(`${chunks[0]}@${protoImportPath(proto, opts)}`)}${chunks
        .slice(1)
        .map((c) => `.${c}`)
        .join("")}`;
    }
    case "protobufjs": {
      chunks.unshift(...proto.file.package.split("."));
      const importPath = protoImportPath(origProto.kind === "Field" ? origProto.parent : origProto, opts);
      return code`${imp(`${chunks[0]}@${importPath}`)}.${chunks.slice(1).join(".")}`;
    }
    case "ts-proto": {
      return code`${imp(`${chunks.join("_")}@${protoImportPath(proto, opts)}`)}`;
    }
    /* istanbul ignore next */
    default: {
      const _exhaustiveCheck: never = opts;
      throw "unreachable";
    }
  }
}

export function createGetFieldValueCode(parent: Code, proto: ProtoField, opts: PrinterOptions): Code {
  switch (opts.protobuf) {
    case "google-protobuf": {
      return code`${parent}.${googleProtobufFieldAccessor("get", proto)}()`;
    }
    case "protobufjs": {
      return code`${parent}.${camelCase(proto.name)}`;
    }
    case "ts-proto": {
      return code`${parent}.${proto.jsonName}`;
    }
    /* istanbul ignore next */
    default: {
      const _exhaustiveCheck: never = opts;
      throw "unreachable";
    }
  }
}

export function createSetFieldValueCode(parent: Code, value: Code, proto: ProtoField, opts: PrinterOptions): Code {
  switch (opts.protobuf) {
    case "google-protobuf": {
      return code`${parent}.${googleProtobufFieldAccessor("set", proto)}(${value})`;
    }
    case "protobufjs": {
      return code`${parent}.${camelCase(proto.name)} = ${value}`;
    }
    case "ts-proto": {
      return code`${parent}.${proto.jsonName} = ${value}`;
    }
    /* istanbul ignore next */
    default: {
      const _exhaustiveCheck: never = opts;
      throw "unreachable";
    }
  }
}

function googleProtobufFieldAccessor(type: "get" | "set", proto: ProtoField) {
  return `${type}${upperCaseFirst(proto.jsonName)}${proto.list ? "List" : ""}`;
}

function upperCaseFirst(s: string): string {
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
}
