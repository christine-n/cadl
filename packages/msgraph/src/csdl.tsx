import {
  EnumMemberType,
  EnumType,
  InterfaceType,
  isKey,
  ModelType,
  ModelTypeProperty,
  NamespaceType,
  OperationType,
  Program,
  Type,
  UnionType,
} from "@cadl-lang/compiler";
import { getRoutePath } from "@cadl-lang/rest";

import React, { FunctionComponent, ReactElement, useContext } from "react";
import ReactDOMServer from "react-dom/server";
import { Item, Literal, styled } from "./common.js";
import { isContains, isOpenModel, isReferences } from "./decorators.js";
import { inspect } from "./inspect.js";

//===================================================================================================

interface EnumMemberProps {
  Name: string;
  Value?: string | number | undefined;
}
const EnumMemberElement = (props: EnumMemberProps) => React.createElement("Member", props);

interface EnumTypeProps {
  Name: string;
  children: any;
}
const EnumTypeElement = (props: EnumTypeProps) => React.createElement("EnumType", props);

interface PropertyProps {
  Name: string;
  Type: string;
  Nullable?: string;
}
const PropertyElement = (props: PropertyProps) => React.createElement("Property", props);

interface NavigationPropertyProps {
  Name: string;
  Type: string;
  ContainsTarget?: string;
}
const NavigationPropertyElement = (props: NavigationPropertyProps) =>
  React.createElement("NavigationProperty", props);

interface ComplexTypeProps {
  Name: string;
  Abstract?: boolean;
  BaseType?: string;
  children: any;
}
const ComplexTypeElement = (props: ComplexTypeProps) => React.createElement("ComplexType", props);

const PropertyRefElement = (props: { Name: string }) => React.createElement("PropertyRef", props);

const KeyElement = (props: { children: any }) => React.createElement("Key", props);

interface EntityTypeProps {
  Name: string;
  Abstract?: boolean;
  BaseType?: string;
  children: any;
}
const EntityTypeElement = (props: EntityTypeProps) => React.createElement("EntityType", props);

const SingletonElement = (props: { Name: string; Type: string; children: any }) =>
  React.createElement("Singleton", props);
const EntitySetElement = (props: { Name: string; EntityType: string; children: any }) =>
  React.createElement("EntitySet", props);
const EntityContainerElement = (props: { Name: string; children: any }) =>
  React.createElement("EntityContainer", props);

interface SchemaProps {
  Namespace: string;
  Alias?: string;
  children: any;
}
const SchemaElement = (props: SchemaProps) =>
  React.createElement("Schema", {
    ...props,
    xmlns: "http://docs.oasis-open.org/odata/ns/edm",
    "xmlns:ags": "http://aggregator.microsoft.com/internal",
  });

//===================================================================================================

function formatXml(xml: string, tab: string = "  ") {
  let formatted = "";
  let indent = "";
  xml.split(/>\s*</).forEach(function (node) {
    if (node.match(/^\/\w/)) {
      indent = indent.substring(tab.length); // decrease indent by one 'tab'
    }

    formatted += indent + "<" + node + ">\r\n";
    if (node.match(/^<?\w[^>]*[^\/]$/)) {
      indent += tab; // increase indent
    }
  });

  return formatted.substring(1, formatted.length - 3);
}

function expandNamespaces(namespace: NamespaceType): NamespaceType[] {
  return [namespace, ...[...namespace.namespaces.values()].flatMap(expandNamespaces)];
}

const ProgramContext = React.createContext<Program>({} as any);

export function renderCsdl(program: Program) {
  const csdl = ReactDOMServer.renderToStaticMarkup(<CadlProgramViewer program={program} />);
  return formatXml(`<?xml version="1.0" encoding="utf-8"?>
  <edmx:Edmx Version="4.0" xmlns:ags="http://aggregator.microsoft.com/internal" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
    <edmx:DataServices>
    ${csdl}
    </edmx:DataServices>
  </edmx:Edmx>`);
}

export interface CadlProgramViewerProps {
  program: Program;
}

function hasChildren(type: Type) {
  switch (type.kind) {
    case "Namespace":
      return type.enums.size || type.models.size || type.interfaces.size || type.operations.size;
    default:
      return true;
  }
}

export const CadlProgramViewer: FunctionComponent<CadlProgramViewerProps> = ({ program }) => {
  const root = program.checker!.getGlobalNamespaceType();
  const excludedNamespaces = ["Cadl"];
  const namespaces = expandNamespaces(root)
    .map((namespace) => ({
      name: program.checker!.getNamespaceString(namespace),
      namespace,
    }))
    .filter(
      (ns) =>
        ns.name &&
        hasChildren(ns.namespace) &&
        excludedNamespaces.every((exclude) => !ns.name.startsWith(exclude))
    );
  return (
    <ProgramContext.Provider value={program}>
      {namespaces.map((ns) => {
        return (
          <SchemaElement Namespace={ns.name}>
            <Elements namespace={ns.namespace} />
          </SchemaElement>
        );
      })}
    </ProgramContext.Provider>
  );
};

const Elements: FunctionComponent<{ namespace: NamespaceType }> = ({ namespace }) => {
  return (
    <>
      <EnumTypeList enums={namespace.enums} />
      <ModelList models={namespace.models} />
      {/* <ItemList items={namespace.interfaces} render={(x) => <Interface type={x} />} />
      <ItemList items={namespace.operations} render={(x) => <Operation type={x} />} />
      <ItemList items={namespace.unions} render={(x) => <Union type={x} />} /> */}
    </>
  );
};

const EntityContainer: FunctionComponent<{ interfaces: Map<string, InterfaceType> }> = (props) => {
  if (!props.interfaces.size) {
    return <></>;
  }

  const program = useContext(ProgramContext);
  const navigationSources = [...props.interfaces.entries()].map(([k, v]) => ({
    path: getRoutePath(program, v)?.path,
    type: v,
  }));

  const entitySets = navigationSources
    .filter((nav) => nav.path && nav.path.lastIndexOf("/") > 0 && nav.type.operations.get("Get"))
    .map((nav) => ({ path: nav.path, returnType: nav.type.operations.get("Get")?.returnType }));

  return (
    <EntityContainerElement Name="container">{"<!-- Some stuff here -->"}</EntityContainerElement>
  );
};

const EnumTypeList: FunctionComponent<{ enums: Map<string, EnumType> }> = (props) => (
  <ItemList
    items={props.enums}
    render={(type) => (
      <EnumTypeElement Name={type.name}>
        <EnumMemberList members={type.members} />
      </EnumTypeElement>
    )}
  />
);

const EnumMemberList: FunctionComponent<{ members: EnumMemberType[] }> = (props) => (
  <ItemList
    items={props.members}
    render={(member) => <EnumMemberElement Name={member.name} Value={member.value} />}
  />
);

const ModelList: FunctionComponent<{ models: Map<string, ModelType> }> = (props) => {
  return (
    <ItemList
      items={props.models}
      render={(model) => {
        const program = useContext(ProgramContext);
        const keyProp = [...model.properties.entries()].find(([k, v]) => isKey(program, v));
        const isOpen = isOpenModel(program, model);

        if (keyProp) {
          return (
            <EntityTypeElement
              Name={model.name}
              BaseType={model.baseModel?.name}
              {...(isOpen ? { OpenType: "true" } : {})}
            >
              <KeyElement>
                <PropertyRefElement Name={keyProp[1].name} />
              </KeyElement>
              <PropertyList properties={model.properties} />
            </EntityTypeElement>
          );
        }

        return (
          <ComplexTypeElement
            Name={model.name}
            BaseType={model.baseModel?.name}
            {...(isOpen ? { OpenType: "true" } : {})}
          >
            <PropertyList properties={model.properties} />
          </ComplexTypeElement>
        );
      }}
    />
  );
};

const PropertyList: FunctionComponent<{ properties: Map<string, ModelTypeProperty> }> = (props) => {
  return (
    <ItemList
      items={props.properties}
      render={(property) => {
        const program = useContext(ProgramContext);
        const isNullable = property.optional;
        const isContained = isContains(program, property);
        const isReferenced = isReferences(program, property);
        const isNavigation = isContained || isReferenced;

        if (isNavigation) {
          return (
            <NavigationPropertyElement
              Name={property.name}
              Type={getIdForType(program, property.type)}
              {...(isContained ? { ContainsTarget: "true" } : {})}
            />
          );
        }

        return (
          <PropertyElement
            Name={property.name}
            Type={getNameForType(property.type)}
            {...(isNullable ? {} : { Nullable: "false" })}
          />
        );
      }}
    />
  );
};

interface ItemListProps<T> {
  items: Map<string, T> | T[];
  render: (t: T) => ReactElement<any, any> | null;
}

const ItemList = <T extends object>(props: ItemListProps<T>) => {
  if (Array.isArray(props.items)) {
    if (props.items.length === 0) {
      return <></>;
    }
  } else {
    if (props.items.size === 0) {
      return <></>;
    }
  }
  return (
    <>
      {[...props.items.entries()].map(([k, v]) => (
        <>{props.render(v)}</>
      ))}
    </>
  );
};

export interface TypeUIProperty {
  name: string;
  value: any;
  description?: string;
}
export interface TypeUIProps {
  type: Type;
  name: string;
  /**
   * Alternate id
   * @default getIdForType(type)
   */
  id?: string;
  properties: TypeUIProperty[];
}

const TypeType = styled.span`
  display: inline;
  color: #7a3e9d;
  margin-right: 5px;
`;

const TypeName = styled.span`
  display: inline;
  color: #333333;
`;
export const TypeUI: FunctionComponent<TypeUIProps> = (props) => {
  const program = useContext(ProgramContext);
  const id = props.id ?? getIdForType(program, props.type);
  const properties = props.properties.map((prop) => {
    return prop.value;
  });
  return (
    <div>
      <div id={id}>
        <TypeType>{props.type.kind}</TypeType>
        <TypeName>{props.name}</TypeName>
      </div>
      <>{properties}</>
    </div>
  );
};

const Interface: FunctionComponent<{ type: InterfaceType }> = ({ type }) => {
  const properties = [
    {
      name: "operations",
      value: <ItemList items={type.operations} render={(x) => <Operation type={x} />} />,
    },
    getDataProperty(type),
  ];
  return <TypeUI type={type} name={type.name} properties={properties} />;
};

const Operation: FunctionComponent<{ type: OperationType }> = ({ type }) => {
  const properties = [
    {
      name: "parameters",
      value: <Model type={type.parameters} />,
    },
    {
      name: "returnType",
      value: <TypeReference type={type.returnType} />,
    },
    getDataProperty(type),
  ];
  return <TypeUI type={type} name={type.name} properties={properties} />;
};

function getDataProperty(type: Type): TypeUIProperty {
  return {
    name: "data",
    description: "in program.stateMap()",
    value: <TypeData type={type} />,
  };
}

export const Model: FunctionComponent<{ type: ModelType }> = ({ type }) => {
  return (
    <EntityTypeElement Name={type.name} BaseType={type.baseModel?.name}>
      {[...type.properties.entries()]
        .map(([key, value]) => value)
        .map((property) => (
          <ModelProperty property={property} />
        ))}
    </EntityTypeElement>
  );
};

const ModelProperty: FunctionComponent<{ property: ModelTypeProperty }> = ({ property }) => {
  return <PropertyElement Name={property.name} Type={getNameForType(property.type)} />;
};

export const Enum: FunctionComponent<{ type: EnumType }> = ({ type }) => {
  return (
    <EnumTypeElement Name={type.name}>
      {type.members.map((member) => {
        return <EnumMemberElement Name={member.name} Value={member.value} />;
      })}
    </EnumTypeElement>
  );
};

const Union: FunctionComponent<{ type: UnionType }> = ({ type }) => {
  const program = useContext(ProgramContext);

  return (
    <Item title={type.name ?? "<unamed union>"} id={getIdForType(program, type)}>
      <TypeData type={type} />

      <UnionOptions type={type} />
    </Item>
  );
};

const UnionOptions: FunctionComponent<{ type: UnionType }> = ({ type }) => {
  if (type.options.length === 0) {
    return <div></div>;
  }
  return (
    <ul>
      {[...type.options.entries()].map(([k, v]) => (
        <li key={k}>
          <TypeReference type={v} />
        </li>
      ))}
    </ul>
  );
};

function getNameForType(type: Type): string {
  switch (type.kind) {
    case "Array":
      return `Collection(${getNameForType(type.elementType)})`;
    case "Union":
      return type.options.map((x, i) => getNameForType(x)).join(" | ");
    case "TemplateParameter":
      return type.node.id.sv;
    case "String":
    case "Number":
    case "Boolean":
      return `${type.value}`;
    case "Namespace":
    case "Operation":
    case "Interface":
    case "Enum":
      return type.name;
    case "Model":
      return getNameForModelType(type);
    default:
      return type.kind;
  }
}

function getNameForModelType(type: ModelType) {
  switch (type.name) {
    case "string":
      return "Edm.String";
    case "bytes":
      return "Collection(Edm.Byte)";
    case "int8":
      return "Edm.Byte";
    case "int16":
      return "Edm.Int16";
    case "int32":
      return "Edm.Int32";
    case "int64":
      return "Edm.Int64";
    case "float32":
      return "Edm.Single";
    case "float64":
      return "Edm.Double";
    case "plainDate":
      return "Edm.Date";
    case "plainTime":
      return "Edm.TimeOfDay";
    case "zonedDateTime":
      return "Edm.DateTimeOffset";
    case "duration":
      return "Edm.Duration";
    case "boolean":
      return "Edm.Boolean";
    case "stream":
      return "Edm.Stream";
    // case "uint8":
    //   return "Edm.uint8";
    // case "uint16":
    //   return "Edm.uint16";
    // case "uint32":
    //   return "Edm.uint32";
    // case "uint64":
    //   return "Edm.uint64";
    // case "safeint":
    //   return "Edm.safeint";
    // case "null":
    //   return "Edm.null";
    default:
      return type.name;
  }
}

function getIdForType(program: Program, type: Type): string {
  switch (type.kind) {
    case "Array":
      return `Collection(${getIdForType(program, type.elementType)})`;
    case "Namespace":
      return program.checker!.getNamespaceString(type);
    case "Model":
    case "Enum":
    case "Union":
    case "Operation":
    case "Interface":
      return `${program.checker!.getNamespaceString(type.namespace)}.${type.name}`;
    case "String":
    case "Number":
    case "Boolean":
      return `${type.value}`;
    default:
      return type.kind;
  }
}

const TypeRef = styled.a`
  color: #268bd2;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const TypeReference: FunctionComponent<{ type: Type }> = ({ type }) => {
  const program = useContext(ProgramContext);
  switch (type.kind) {
    case "Namespace":
    case "Operation":
    case "Interface":
    case "Enum":
    case "Model":
      const id = getIdForType(program, type);
      const href = `#${id}`;
      return (
        <TypeRef href={href} title={type.kind + ": " + id}>
          {type.name}
        </TypeRef>
      );
    case "Array":
      return (
        <>
          <TypeReference type={type.elementType} />
          {"[]"}
        </>
      );
    case "Union":
      return (
        <>
          {type.options.map((x, i) => {
            return (
              <span key={i}>
                <TypeReference type={x} />
                {i < type.options.length - 1 ? " | " : ""}
              </span>
            );
          })}
        </>
      );
    case "TemplateParameter":
      return <span>Template Param: {type.node.id.sv}</span>;
    case "String":
      return <Literal>"{type.value}"</Literal>;
    case "Number":
    case "Boolean":
      return <>{type.value}</>;
    default:
      return null;
  }
};

const TypeDataEntry = styled.div`
  display: flex;
`;
const TypeDataKey = styled.div`
  color: #333;
  margin-right: 5px;
`;
const TypeDataValue = styled.div``;
const TypeData: FunctionComponent<{ type: Type }> = ({ type }) => {
  const program = useContext(ProgramContext);
  const entries = [...program.stateMaps.entries()]
    .map(([k, v]) => [k, v.get(type)])
    .filter(([k, v]) => !!v);
  if (entries.length === 0) {
    return null;
  }
  return (
    <ul>
      {entries.map(([k, v], i) => (
        <TypeDataEntry key={i}>
          <TypeDataKey>{k.toString()}:</TypeDataKey> <TypeDataValue>{inspect(v)}</TypeDataValue>
        </TypeDataEntry>
      ))}
    </ul>
  );
};
