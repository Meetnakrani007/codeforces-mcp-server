import React from "react"
import ReactDOM from "react-dom"
import Header from "./header";
import Body from "./Body";
import Footer from "./Footer";

// functional component -> function  class component

// functional component variable always start with capital letter and return only one element

// jsx javascriptXML

// alwas write the js code inside the courly bracket {}

// My Api: https://codeforces.com/api/user.info?handles=Satyam_86770

// hook useState and useEffect

let MyWebPage=()=>{
    return(
        [  
         <Header/>,
         <Body/>,
         <Footer/>
        ]
    )
}

let root=document.getElementById("root")
let reactRoot=ReactDOM.createRoot(root)
reactRoot.render(<MyWebPage/>);

