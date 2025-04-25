import React from  'react';
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import { PiPianoKeysFill } from "react-icons/pi";
import { Link } from 'react-router-dom';
import './Header.css'

const Header : React.FC = () => {
    return(
        <nav className={"header-nav"}>
            <div className={"header-container"}>
                <div className={"logo-container"}>
                    <Link to={"/"} className='header-link'>
                        <PiPianoKeysFill/>
                        <h4>ReactSynth</h4>
                    </Link>
                </div>
                <div className={"button-container"}>
                    <button>
                        <FaArrowLeft/>
                    </button>
                    <button>
                        <FaArrowRight/>
                    </button>
                </div>
            </div>
        </nav>
    )
}

export default Header;