import {
  EnumType,
  InterfaceType,
  ModelType,
  ModelTypeProperty,
  NamespaceType,
  OperationType,
  Program,
  Type,
  UnionType,
} from "@cadl-lang/compiler";
import React, { FunctionComponent, ReactElement, useContext } from "react";
import ReactDOMServer from "react-dom/server";
import { Item, Literal, styled } from "./common.js";
import { inspect } from "./inspect.js";

//===================================================================================================

interface EnumMemberProps {
  Name: string;
  Value?: string | number | undefined;
}
const EnumMemberElement = (props: EnumMemberProps) => React.createElement("EnumMember", props);

interface EnumTypeProps {
  Name: string;
  children: any;
}
const EnumTypeElement = (props: EnumTypeProps) => React.createElement("EnumType", props);

interface PropertyProps {
  Name: string;
  Type: string;
  Nullable?: boolean;
}
const PropertyElement = (props: PropertyProps) => React.createElement("Property", props);

interface ComplexTypeProps {
  Name: string;
  Abstract?: boolean;
  BaseType?: string;
}
const ComplexTypeElement = (props: ComplexTypeProps) => React.createElement("ComplexType", props);

interface EntityTypeProps {
  Name: string;
  Abstract?: boolean;
  BaseType?: string;
  children: any;
}
const EntityTypeElement = (props: EntityTypeProps) => React.createElement("EntityType", props);

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

function expandNamespaces(namespace: NamespaceType): NamespaceType[] {
  return [namespace, ...[...namespace.namespaces.values()].flatMap(expandNamespaces)];
}

const ProgramContext = React.createContext<Program>({} as any);

export function renderCsdl(program: Program) {
  const csdl = ReactDOMServer.renderToStaticMarkup(<CadlProgramViewer program={program} />);
  return `<?xml version="1.0" encoding="utf-8"?>
  <edmx:Edmx Version="4.0" xmlns:ags="http://aggregator.microsoft.com/internal" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
    <edmx:DataServices>
    ${csdl}
    </edmx:DataServices>
  </edmx:Edmx>`;
}

export interface CadlProgramViewerProps {
  program: Program;
}

export const CadlProgramViewer: FunctionComponent<CadlProgramViewerProps> = ({ program }) => {
  const root = program.checker!.getGlobalNamespaceType();
  const namespaces = expandNamespaces(root).filter((ns) => ns.name && ns.name !== "Cadl");
  return (
    <ProgramContext.Provider value={program}>
      {namespaces.map((namespace) => {
        const namespaceString = program.checker!.getNamespaceString(namespace) || "Oyaa";
        return (
          <SchemaElement Namespace={namespaceString}>
            <Elements namespace={namespace} />
          </SchemaElement>
        );
      })}
    </ProgramContext.Provider>
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

export interface ItemListProps<T> {
  items: Map<string, T> | T[];
  render: (t: T) => ReactElement<any, any> | null;
}

export const ItemList = <T extends object>(props: ItemListProps<T>) => {
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

const Elements: FunctionComponent<{ namespace: NamespaceType }> = ({ namespace }) => {
  return (
    <>
      <ItemList items={namespace.enums} render={(x) => <Enum type={x} />} />
      <ItemList items={namespace.models} render={(x) => <Model type={x} />} />
      <ItemList items={namespace.interfaces} render={(x) => <Interface type={x} />} />
      <ItemList items={namespace.operations} render={(x) => <Operation type={x} />} />
      <ItemList items={namespace.unions} render={(x) => <Union type={x} />} />
    </>
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

function getTypeName(type: Type): string {
  switch (type.kind) {
    case "Array":
      return `Collection(${getTypeName(type.elementType)})`;
    case "Union":
      return type.options.map((x, i) => getTypeName(x)).join(" | ");
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
    case "Model":
      return type.name;
    default:
      return type.kind;
  }
}

const ModelProperty: FunctionComponent<{ property: ModelTypeProperty }> = ({ property }) => {
  return <PropertyElement Name={property.name} Type={getTypeName(property.type)} />;
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

function getIdForType(program: Program, type: Type) {
  switch (type.kind) {
    case "Namespace":
      return program.checker!.getNamespaceString(type);
    case "Model":
    case "Enum":
    case "Union":
    case "Operation":
    case "Interface":
      return `${program.checker!.getNamespaceString(type.namespace)}.${type.name}`;
    default:
      return undefined;
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
