import { FileDescriptorProto } from "google-protobuf/google/protobuf/descriptor_pb";
import ts from "typescript";
import { Field, Message } from "./types";

export function printSource(fd: FileDescriptorProto, msgs: Message[]): string {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const msgASTs = msgs.map((m) => new MessageAST(m));
  let ast: ts.Statement[] = [
    ts.factory.createImportDeclaration(
      undefined,
      undefined,
      ts.factory.createImportClause(
        false,
        undefined,
        ts.factory.createNamedImports([
          ts.factory.createImportSpecifier(
            undefined,
            ts.factory.createIdentifier("objectType")
          ),
        ])
      ),
      ts.factory.createStringLiteral("@nexus/schema")
    ),
  ];

  const unwrapFuncs = uniq(
    compact(msgASTs.flatMap((m) => m.fields.map((f) => f.unwrapFunc))),
    (f) => f.name
  );

  const imports = [...new Set(unwrapFuncs.flatMap((f) => f.imports))];
  for (const imp of imports) {
    ast.push(createImportAllWithAliastDecl(imp));
  }

  ast = [...ast, ...msgASTs.map((m) => m.build())];

  const file = ts.factory.updateSourceFile(
    ts.createSourceFile(
      "generated.ts",
      "",
      ts.ScriptTarget.Latest,
      false,
      ts.ScriptKind.TS
    ),
    ast,
    false
  );
  const result = printer.printFile(file);

  return [
    "// Code generated by protoc-gen-nexus. DO NOT EDIT.",
    `// source: ${fd.getName()}`,
    "",
    result,
  ].join("\n");
}

class MessageAST {
  private readonly msg: Message;

  constructor(msg: Message) {
    this.msg = msg;
  }

  get fields(): FieldAST[] {
    return this.msg.fields.map((f) => new FieldAST(f));
  }

  public build(): ts.Statement {
    return ts.factory.createVariableStatement(
      [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createVariableDeclarationList(
        [
          ts.factory.createVariableDeclaration(
            this.msg.name,
            undefined,
            undefined,
            this.buildObjectType()
          ),
        ],
        ts.NodeFlags.Const
      )
    );
  }

  private buildObjectType(): ts.Expression {
    const { name, description } = this.msg;

    return ts.factory.createCallExpression(
      ts.factory.createIdentifier("objectType"),
      undefined,
      [
        ts.factory.createObjectLiteralExpression(
          [
            ts.factory.createPropertyAssignment(
              "name",
              ts.factory.createStringLiteral(name)
            ),
            ts.factory.createPropertyAssignment(
              "description",
              ts.factory.createStringLiteral(description)
            ),
            // TODO: "description" property
            ts.factory.createMethodDeclaration(
              undefined,
              undefined,
              undefined,
              "definition",
              undefined,
              undefined,
              [
                ts.factory.createParameterDeclaration(
                  undefined,
                  undefined,
                  undefined,
                  "t",
                  undefined,
                  undefined,
                  undefined
                ),
              ],
              undefined,
              ts.factory.createBlock(
                this.fields.map((f) => f.build()),
                true
              )
            ),
            ts.factory.createPropertyAssignment(
              "rootTyping",
              ts.factory.createObjectLiteralExpression([
                ts.factory.createPropertyAssignment(
                  "name",
                  ts.factory.createStringLiteral(name)
                ),
                ts.factory.createPropertyAssignment(
                  "path",
                  ts.factory.createStringLiteral(this.msg.importPath)
                ),
              ])
            ),
          ],
          true
        ),
      ]
    );
  }
}

class FieldAST {
  private readonly field: Field;

  constructor(field: Field) {
    this.field = field;
  }

  public build(): ts.Statement {
    const { name } = this.field;

    return ts.factory.createExpressionStatement(
      ts.factory.createCallExpression(this.fieldFunction, undefined, [
        ts.factory.createStringLiteral(name),
        this.options,
      ])
    );
  }

  get unwrapFunc(): UnwrapFunc | null {
    return unwrapFuncs[this.field.protoTypeName] || null;
  }

  private get fieldFunction(): ts.Expression {
    let left: ts.Expression = ts.factory.createIdentifier("t");

    left = ts.factory.createPropertyAccessExpression(
      left,
      ts.factory.createIdentifier(
        this.field.isNullable() ? "nullable" : "nonNull"
      )
    );

    if (this.field.type.kind === "list") {
      left = ts.factory.createPropertyAccessExpression(
        left,
        ts.factory.createIdentifier("list")
      );
    }

    return ts.factory.createPropertyAccessExpression(
      left,
      ts.factory.createIdentifier(this.nexusTypeName)
    );
  }

  private get nexusTypeName(): string {
    const { type } = this.field;

    switch (type.kind) {
      case "list":
        return "field";
      case "scalar":
        switch (type.type) {
          case "Int":
            return "int";
          case "Float":
            return "float";
          case "String":
            return "string";
          case "Boolean":
            return "boolean";
          case "ID":
            return "id";
          case "DateTime":
            return "dateTime";
          default:
            const _exhaustiveCheck: never = type; // eslint-disable-line
            throw "unreachable";
        }
      case "object":
        return "field";
      default:
        const _exhaustiveCheck: never = type; // eslint-disable-line
        throw "unreachable";
    }
  }

  private get options(): ts.ObjectLiteralExpression {
    const { getterName, description, type } = this.field;
    const props: ts.ObjectLiteralElementLike[] = [
      ts.factory.createPropertyAssignment(
        "description",
        ts.factory.createStringLiteral(description)
      ),
    ];

    if (type.kind === "list") {
      props.push(
        ts.factory.createPropertyAssignment(
          "type",
          ts.factory.createStringLiteral(type.type.type)
        )
      );
    }

    if (type.kind === "object") {
      props.push(
        ts.factory.createPropertyAssignment(
          "type",
          ts.factory.createStringLiteral(type.type)
        )
      );
    }

    let resolverRet: ts.Expression = ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier("root"),
        ts.factory.createIdentifier(getterName)
      ),
      undefined,
      undefined
    );
    if (this.unwrapFunc !== null) {
      resolverRet = ts.factory.createCallExpression(
        ts.factory.createIdentifier(this.unwrapFunc.name),
        undefined,
        [resolverRet]
      );
    }

    props.push(
      ts.factory.createMethodDeclaration(
        undefined,
        undefined,
        undefined,
        "resolve",
        undefined,
        undefined,
        [
          ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            undefined,
            "root",
            undefined,
            undefined,
            undefined
          ),
        ],
        undefined,
        ts.factory.createBlock([ts.factory.createReturnStatement(resolverRet)])
      )
    );

    return ts.factory.createObjectLiteralExpression(props, true);
  }
}

function compact<T>(input: T[]): NonNullable<T>[] {
  return input.filter((v): v is NonNullable<T> => v != null);
}

function uniq<T, V>(input: T[], f?: (t: T) => V) {
  const out = [] as T[];
  const set = new Set<T | V>();

  for (const v of input) {
    const key = f ? f(v) : v;
    if (!set.has(key)) {
      set.add(key);
      out.push(v);
    }
  }

  return out;
}

function uniqueImportAlias(path: string) {
  return path.replace(/@/g, "$$").replace(/\//g, "$").replace(/-/g, "_");
}

type UnwrapFunc = {
  imports: string[];
  name: string;
};

const unwrapFuncs: Record<string, UnwrapFunc> = {
  ".google.protobuf.Int32Value": {
    imports: ["proto-nexus"],
    name: `${uniqueImportAlias("proto-nexus")}.unwrapInt32Value`,
  },
  ".google.protobuf.UInt32Value": {
    imports: ["proto-nexus"],
    name: `${uniqueImportAlias("proto-nexus")}.unwrapUInt32Value`,
  },
  ".google.protobuf.Int64Value": {
    imports: ["proto-nexus"],
    name: `${uniqueImportAlias("proto-nexus")}.unwrapInt64Value`,
  },
  ".google.protobuf.UInt64Value": {
    imports: ["proto-nexus"],
    name: `${uniqueImportAlias("proto-nexus")}.unwrapUInt64Value`,
  },
  ".google.protobuf.FloatValue": {
    imports: ["proto-nexus"],
    name: `${uniqueImportAlias("proto-nexus")}.unwrapFloatValue`,
  },
  ".google.protobuf.DoubleValue": {
    imports: ["proto-nexus"],
    name: `${uniqueImportAlias("proto-nexus")}.unwrapDoubleValue`,
  },
  ".google.protobuf.StringValue": {
    imports: ["proto-nexus"],
    name: `${uniqueImportAlias("proto-nexus")}.unwrapStringValue`,
  },
  ".google.protobuf.BoolValue": {
    imports: ["proto-nexus"],
    name: `${uniqueImportAlias("proto-nexus")}.unwrapBoolValue`,
  },
  ".google.protobuf.Timestamp": {
    imports: ["proto-nexus"],
    name: `${uniqueImportAlias("proto-nexus")}.timestampToDate`,
  },
};

function createImportAllWithAliastDecl(path: string): ts.ImportDeclaration {
  return ts.factory.createImportDeclaration(
    undefined,
    undefined,
    ts.factory.createImportClause(
      false,
      undefined,
      ts.factory.createNamespaceImport(
        ts.factory.createIdentifier(uniqueImportAlias(path))
      )
    ),
    ts.factory.createStringLiteral(path)
  );
}
